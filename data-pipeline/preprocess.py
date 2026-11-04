# -*- coding: utf-8 -*-
"""
学生成绩数据集 —— 数据预处理脚本（阶段 2）
=========================================
数据来源: UCI Student Performance 数据集
  - student-mat.csv : 数学课 395 条
  - student-por.csv : 葡萄牙语课 649 条
目标:
  1. 清洗: 分隔符、类型转换、一致性检查
  2. 派生: 缺考标记、及格标记、成绩等级等分析字段
  3. 合并: 两门课合并成总表 + 按 R 脚本思路找 382 个共同学生
  4. 输出: 标准化 CSV, 供 MySQL 入库和后续建模使用
"""

import os
import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
OUT_DIR = os.path.join(BASE_DIR, "output")
os.makedirs(OUT_DIR, exist_ok=True)

# 两张表共有的键字段（来自官方 student-merge.R，用于识别同一学生）
MERGE_KEYS = [
    "school", "sex", "age", "address", "famsize", "Pstatus",
    "Medu", "Fedu", "Mjob", "Fjob", "reason", "nursery", "internet",
]

# yes/no 类二值字段
BINARY_COLS = [
    "schoolsup", "famsup", "paid", "activities",
    "nursery", "higher", "internet", "romantic",
]


def load_raw(path: str, course: str) -> pd.DataFrame:
    """读取原始 CSV（分号分隔），并加 course 列标记科目。"""
    df = pd.read_csv(path, sep=";")
    df["course"] = course
    return df


def clean(df: pd.DataFrame, course: str) -> pd.DataFrame:
    """单表清洗流程，每一步都有注释，方便你在 PyCharm 里对照学习。"""
    print(f"\n===== 清洗 {course} (原始 {len(df)} 行) =====")

    # 1) 去掉字符串两端空格（防脏数据）
    #    用 dtype 判断而非 select_dtypes, 兼容 pandas 2.x / 3.x
    str_cols = [c for c in df.columns if not pd.api.types.is_numeric_dtype(df[c])]
    for col in str_cols:
        df[col] = df[col].astype(str).str.strip()

    # 2) 类型强制转换
    #    por 文件里 G1/G2 曾出现带引号的 "5"，统一转成数值
    for col in ["age", "Medu", "Fedu", "traveltime", "studytime", "failures",
                "famrel", "freetime", "goout", "Dalc", "Walc", "health",
                "absences", "G1", "G2", "G3"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    bad = df[["G1", "G2", "G3"]].isnull().sum().sum()
    print(f"类型转换失败数: {bad}")
    df = df.dropna(subset=["G1", "G2", "G3"])

    # 3) 合理性检查
    #    成绩应在 0-20 之间，超出视为异常
    for col in ["G1", "G2", "G3"]:
        n_bad = ((df[col] < 0) | (df[col] > 20)).sum()
        print(f"{col} 超范围异常: {n_bad}")
        df = df[(df[col] >= 0) & (df[col] <= 20)]
    # 年龄限定 15-22
    df = df[(df["age"] >= 15) & (df["age"] <= 22)]

    # 4) 缺考处理: G3=0 且 G1、G2 都有分 => 大概率缺考/退学，不是真考 0 分
    #    不删除, 加标记列, 建模时可自行过滤
    df["is_withdrawn"] = ((df["G3"] == 0)).astype(int)
    print(f"缺考(G3=0)记录: {df['is_withdrawn'].sum()} 条")

    # 5) 派生分析字段
    #    及格线: 葡萄牙制 20 分制, 通常 >=10 算通过
    df["pass_g3"] = (df["G3"] >= 10).astype(int)
    #    等级: A(16-20) B(14-15) C(12-13) D(10-11) F(<10), 缺考记为 W
    def grade(g, withdrawn):
        if withdrawn:
            return "W"
        if g >= 16: return "A"
        if g >= 14: return "B"
        if g >= 12: return "C"
        if g >= 10: return "D"
        return "F"
    df["grade"] = [grade(g, w) for g, w in zip(df["G3"], df["is_withdrawn"])]
    #    期末较第二期的进步幅度 (G3 - G2)
    df["improvement"] = df["G3"] - df["G2"]
    #    高缺勤标记 (absences > 20 视为高缺勤)
    df["high_absence"] = (df["absences"] > 20).astype(int)

    # 6) 二值字段数值化 (yes/no -> 1/0)
    #    原列直接替换成 1/0: 数据库 student 表这 8 列是 TINYINT,
    #    如果保留 "yes"/"no" 字符串, 入库会报
    #    (1366, "Incorrect integer value: 'yes' for column 'schoolsup'")
    for col in BINARY_COLS:
        if col in df.columns:
            df[col] = df[col].map({"yes": 1, "no": 0}).fillna(df[col]).astype(int)
        # 同时保留 *_n 副本, 方便做相关性分析时一眼看出语义
        df[col + "_n"] = df[col]
    df["sex_n"] = df["sex"].map({"F": 0, "M": 1})
    df["address_n"] = df["address"].map({"U": 1, "R": 0})

    print(f"清洗后: {len(df)} 行")
    return df


def main():
    math_df = load_raw(os.path.join(DATA_DIR, "student-mat.csv"), "math")
    por_df = load_raw(os.path.join(DATA_DIR, "student-por.csv"), "por")

    math_clean = clean(math_df, "math")
    por_clean = clean(por_df, "por")

    # ---- 合并成总表（纵向拼接, course 列区分科目）----
    all_df = pd.concat([math_clean, por_clean], ignore_index=True)
    # 共同学生（按 R 脚本的键合并, 左右成绩列加后缀区分）
    merged = pd.merge(
        math_clean, por_clean,
        on=MERGE_KEYS, suffixes=("_mat", "_por"),
    )
    print(f"\n两门课共同学生记录（按官方键合并）: {len(merged)} 条")

    # ---- 输出 ----
    outputs = {
        "cleaned_math.csv": math_clean,
        "cleaned_por.csv": por_clean,
        "students_all.csv": all_df,          # 1044 条, 带 course 列, 入库主表
        "students_both_courses.csv": merged,  # 382 个共同学生, 跨科目对比用
    }
    for name, df in outputs.items():
        path = os.path.join(OUT_DIR, name)
        df.to_csv(path, index=False, encoding="utf-8-sig")
        print(f"已输出: output/{name}  ({len(df)} 行 x {df.shape[1]} 列)")

    # ---- 快速 EDA 摘要, 给前端看板选题参考 ----
    print("\n===== EDA 摘要 =====")
    g = all_df.groupby("course")["G3"]
    print(g.agg(["count", "mean", "std"]).round(2))
    print("\n性别与成绩(G3均值):")
    print(all_df[all_df["is_withdrawn"] == 0]
          .pivot_table(index="sex", columns="course", values="G3", aggfunc="mean")
          .round(2))
    print("\n学习时间 vs 及格率:")
    print(all_df[all_df["is_withdrawn"] == 0]
          .pivot_table(index="studytime", columns="course", values="pass_g3", aggfunc="mean")
          .round(2))


if __name__ == "__main__":
    main()
