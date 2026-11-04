# 学生成绩数据可视化大屏

基于 **UCI Student Performance** 数据集的完整数据分析项目：从原始 CSV 清洗入库，到 Spring Boot 提供统计接口，再到 ECharts 暗色大屏实时展示。

> 一条完整的数据链路：`Excel/CSV → pandas 清洗 → MySQL → Spring Boot REST API → ECharts 大屏`

## 功能特性

- **数据预处理**：类型转换、缺考标记、派生指标（及格率/等级/进步幅度）、两科目合并、跨科目同人识别
- **REST 接口**：分页筛选、总览统计、等级分布、分数段、缺勤影响、二维热力、动态分组分析
- **可视化大屏**：6 个 KPI + 9 张图表，暗色科技风，一屏铺满、自动适配窗口，无需滚动
- **可交互分析**：13 个维度下拉联动（学习时间、父母学历、饮酒、恋爱、升学意愿…）

## 技术栈

| 层次 | 技术 | 说明 |
|---|---|---|
| 数据处理 | Python 3.10 + pandas + SQLAlchemy | 见 `data-pipeline/` |
| 数据库 | MySQL 8.3 | 主表 + 视图 `v_student_score` |
| 后端 | Spring Boot 2.7.18 + MyBatis-Plus 3.5 + JDK 8 | 端口 8080 |
| 前端 | 原生 HTML/CSS/JS + ECharts 5.5 | 打包进 `static/`，同源访问 |

## 项目结构

```
student-performance-backend/
├── pom.xml
├── src/main/
│   ├── java/com/student/perf/
│   │   ├── BackendApplication.java     启动类
│   │   ├── common/Result.java          统一返回 {code,msg,data}
│   │   ├── config/                     MyBatis-Plus 分页、CORS
│   │   ├── controller/                 StudentController / StatsController
│   │   ├── mapper/                     StudentScoreMapper（含聚合 SQL）
│   │   └── pojo/                       StudentScore / ScoreStats / HeatStat
│   └── resources/
│       ├── application.yml             数据源与 MP 配置
│       └── static/                     ← 大屏页面（index.html + css + js）
└── data-pipeline/                      ← 数据管线（Python）
    ├── preprocess.py                   清洗 + 派生字段 + 合并
    ├── load_data.py                    写入 MySQL（事务保护，可重复执行）
    ├── schema.sql                      建库建表
    ├── requirements.txt
    └── data/                           原始数据（数学 395 / 葡语 649）
```

## 快速开始

### 1. 建库建表

```bash
mysql -uroot -p < data-pipeline/schema.sql
```

创建数据库 `student_performance`，包含 `student`（学生属性）、`score`（成绩事实）两张表和视图 `v_student_score`。

### 2. 数据清洗与入库

```bash
cd data-pipeline
pip install -r requirements.txt
```

在 `data-pipeline/` 下新建 `db_config.json`（该文件已被 `.gitignore` 排除）：

```json
{"user":"root","password":"你的密码","host":"127.0.0.1","port":3306,"database":"student_performance"}
```

```bash
python preprocess.py     # 输出 output/*.csv
python load_data.py      # 写入 MySQL，并打印校验结果
```

预期结果：`student` 1044 条、`score` 1044 条，数学均分 10.42 / 葡语均分 11.91。

### 3. 启动后端

IDEA 打开本项目（JDK 8），运行 `BackendApplication`，或：

```bash
mvn spring-boot:run
```

数据库密码默认值写在 `application.yml`，可改用环境变量覆盖：

```bash
DB_PASSWORD=你的密码 mvn spring-boot:run
```

### 4. 打开大屏

浏览器访问 **http://localhost:8080/index.html**

## 接口一览

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/students?page=1&size=10&course=math&sex=F&grade=A` | 分页 + 条件筛选学生成绩 |
| GET | `/api/students/{id}` | 单条成绩详情 |
| GET | `/api/stats/overview` | 各科目人数、均分、及格率、平均缺勤 |
| GET | `/api/stats/grades` | 等级分布 A~F + W（缺考） |
| GET | `/api/stats/distribution` | 分数段结构（0-5 / 6-9 / 10-13 / 14-16 / 17-20） |
| GET | `/api/stats/absences` | 缺勤区间对均分与及格率的影响 |
| GET | `/api/stats/heatmap` | 学习时间 × 外出频率 → 均分热力 |
| GET | `/api/stats/group?by=studytime` | 分组分析，`by` 支持 13 个维度（白名单校验，防注入） |

`by` 可选值：`sex` `address` `school` `studytime` `traveltime` `failures` `goout` `dalc` `walc` `freetime` `health` `romantic` `higher` `medu` `fedu`

返回格式统一为：

```json
{ "code": 200, "msg": "success", "data": ... }
```

## 数据集说明

[UCI Machine Learning Repository — Student Performance](https://archive.ics.uci.edu/dataset/320/student+performance)（2012，葡萄牙两所中学）

- 33 个原始字段：个人属性、家庭背景、行为习惯、三阶段成绩（G1/G2/G3）
- 目标变量 `G3`：期末成绩 0-20 分
- `G3 = 0` 的 53 条记录视为缺考（`is_withdrawn = 1`），统计时排除而非删除

## 数据处理要点

1. 原始文件用**分号 `;`** 分隔，且葡语文件的 G1/G2 带引号，需强制类型转换
2. 数据集**没有学号**，13 个属性组合会碰撞 → 用「科目-行号」作为 `student_key`，另用 `person_key` 保留跨科目同人识别
3. 8 个 yes/no 字段统一转 `1/0`（与数据库 `TINYINT` 对齐），否则入库报 `1366 Incorrect integer value`
4. 入库用 `DELETE`（事务内可回滚）而非 `TRUNCATE`（DDL 不可回滚），插入失败不会丢数据

## 开发提示

- 静态资源引用带版本号 `style.css?v=xxx`：改完 CSS/JS 记得改一下后缀，避免浏览器缓存
- `application.yml` 默认密码仅供本地学习，**部署到公网前请改用环境变量**
- `target/`、`.idea/`、`db_config.json` 已在 `.gitignore` 中排除
