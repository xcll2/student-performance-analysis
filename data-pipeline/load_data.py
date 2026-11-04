# -*- coding: utf-8 -*-
"""
学生成绩数据 —— MySQL 入库脚本
================================
前置条件:
  1. MySQL 服务已启动
  2. 已执行 schema.sql 建好库表
  3. 已安装依赖: pip install pandas pymysql sqlalchemy

用法:
  python load_data.py

连接信息从同目录的 db_config.json 读取（不要把密码写进代码）
可重复执行: 每次运行会先清空表再重新导入
"""

import json
import os

import pandas as pd
from sqlalchemy import create_engine, text

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, "db_config.json")

# 与 schema.sql / preprocess.py 保持一致的识别键
MERGE_KEYS = [
    "school", "sex", "age", "address", "famsize", "Pstatus",
    "Medu", "Fedu", "Mjob", "Fjob", "reason", "nursery", "internet",
]

# 源数据列名 -> 数据库列名（MySQL 列统一小写）
RENAME_MAP = {
    "Pstatus": "p_status", "Medu": "medu", "Fedu": "fedu",
    "Mjob": "mjob", "Fjob": "fjob", "Dalc": "dalc", "Walc": "walc",
}

STUDENT_COLS = [
    "school", "sex", "age", "address", "famsize", "p_status",
    "medu", "fedu", "mjob", "fjob", "reason", "guardian",
    "traveltime", "studytime", "failures", "schoolsup", "famsup",
    "paid", "activities", "nursery", "higher", "internet", "romantic",
    "famrel", "freetime", "goout", "dalc", "walc", "health",
]

SCORE_COLS = [
    "student_id", "course", "g1", "g2", "g3", "absences",
    "is_withdrawn", "pass_g3", "grade", "improvement", "high_absence",
]

# 数据库中这 8 列是 TINYINT(1/0); 若 CSV 仍是 yes/no 会报
# (1366, "Incorrect integer value: 'yes' ..."), 入库前统一兜底转换
BINARY_COLS = [
    "schoolsup", "famsup", "paid", "activities",
    "nursery", "higher", "internet", "romantic",
]


def normalize_binary(df: pd.DataFrame) -> pd.DataFrame:
    """把 yes/no 之类的字符串二值列统一成 1/0（已是数字则原样保留）"""
    for col in BINARY_COLS:
        if col not in df.columns:
            continue
        if df[col].dtype == object:
            df[col] = (
                df[col].astype(str).str.strip().str.lower()
                .map({"yes": 1, "no": 0, "1": 1, "0": 0})
                .fillna(0)
                .astype(int)
            )
    return df


def load_config() -> dict:
    if not os.path.exists(CONFIG_PATH):
        raise FileNotFoundError(
            f"缺少配置文件 {CONFIG_PATH}，请先创建 db_config.json"
        )
    with open(CONFIG_PATH, encoding="utf-8") as f:
        return json.load(f)


def build_engine(cfg: dict):
    url = (
        "mysql+pymysql://{user}:{password}@{host}:{port}/{database}"
        "?charset=utf8mb4".format(**cfg)
    )
    return create_engine(url)


def main():
    cfg = load_config()
    engine = build_engine(cfg)

    # 连通性检查, 给出比 SQLAlchemy 原始堆栈更清楚的提示
    try:
        with engine.connect() as conn:
            ver = conn.execute(text("SELECT VERSION()")).scalar()
        print(f"已连接 MySQL {ver} @ {cfg['host']}:{cfg['port']}/{cfg['database']}")
    except Exception as e:
        print("连接失败, 请检查:")
        print("  1. MySQL 服务是否启动 (services.msc 查看 MySQL)")
        print("  2. db_config.json 中的密码是否正确")
        print("  3. 数据库是否已创建 (mysql -uroot -p < schema.sql)")
        raise SystemExit(f"原始错误: {e}")

    csv_path = os.path.join(BASE_DIR, "output", "students_all.csv")
    if not os.path.exists(csv_path):
        raise SystemExit("找不到 output/students_all.csv，请先运行 preprocess.py")

    df = pd.read_csv(csv_path)
    df = normalize_binary(df)

    # 1) 生成唯一键
    #    数据集没有学号, 且 13 个属性组合存在碰撞(不同学生可能完全一样),
    #    所以用 "科目-该科目内行号" 作为确定性唯一键, 保证一人一条学生记录
    seq = df.groupby("course").cumcount() + 1
    df["student_key"] = df["course"] + "-" + seq.map(lambda i: f"{i:04d}")
    #    另存属性组合键, 用于跨科目分析"同一人"的两门课成绩(可能不唯一)
    df["person_key"] = df[MERGE_KEYS].astype(str).agg("|".join, axis=1)

    # 2) 组装学生表（每条记录一个学生实体, 属性字段 + 两个键）
    students = df.rename(columns=RENAME_MAP)[STUDENT_COLS + ["student_key", "person_key"]]

    # 3) 组装成绩表（先占位 student_id，插入后回填）
    scores = df.rename(columns={
        "G1": "g1", "G2": "g2", "G3": "g3",
    })[["student_key", "course", "g1", "g2", "g3", "absences",
        "is_withdrawn", "pass_g3", "grade", "improvement", "high_absence"]].copy()

    with engine.begin() as conn:
        # 用 DELETE 而不是 TRUNCATE:
        # TRUNCATE 是 DDL, 无法回滚 —— 一旦后面的插入失败(类型不匹配/约束冲突),
        # 表就变成空的且数据找不回来(之前踩过这个坑)。
        # DELETE 在事务内执行, 插入出错时整个事务回滚, 旧数据保持完好。
        # 先删子表 score 再删父表 student, 满足外键约束
        conn.execute(text("DELETE FROM score"))
        conn.execute(text("DELETE FROM student"))

        students.to_sql("student", conn, if_exists="append", index=False)

        # 回读 id 建立映射
        key_map = pd.read_sql("SELECT id, student_key FROM student", conn)
        print(f"学生表写入 {len(key_map)} 条")

        scores = scores.merge(
            key_map.rename(columns={"id": "student_id"}),
            on="student_key", how="left",
        )
        missing = scores["student_id"].isna().sum()
        if missing:
            print(f"警告: {missing} 条成绩未匹配到学生")
        scores["student_id"] = scores["student_id"].astype(int)

        scores[SCORE_COLS].to_sql("score", conn, if_exists="append", index=False)
        print(f"成绩表写入 {len(scores)} 条")

    # 4) 验证
    with engine.connect() as conn:
        for sql, label in [
            ("SELECT COUNT(*) AS total FROM student", "学生总数"),
            ("SELECT COUNT(*) AS total FROM score", "成绩记录数"),
            ("SELECT course, COUNT(*) AS cnt, ROUND(AVG(g3),2) AS avg_g3 "
             "FROM score GROUP BY course", "分科目"),
        ]:
            print(f"\n[{label}]")
            print(pd.read_sql(sql, conn).to_string(index=False))


if __name__ == "__main__":
    main()
