-- ============================================================
-- 学生成绩分析系统 —— MySQL 建表脚本
-- 数据库: student_performance
-- 说明: 两张表(学生信息 + 成绩事实表)的标准范式设计
--   student : 一个学生一行 (个人/家庭/习惯等属性)
--   score   : 一个学生一门课一行 (G1/G2/G3/出勤)
-- ============================================================

CREATE DATABASE IF NOT EXISTS student_performance
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE student_performance;

-- ------------------------------------------------------------
-- 1. 学生信息表（来自清洗后数据的 30 个属性字段）
--    说明: 数据集没有学号, 用 school+sex+age+address+famsize+Pstatus
--          +Medu+Fedu+Mjob+Fjob+reason+nursery+internet 组合近似唯一
--          (与官方 student-merge.R 的识别方式一致)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS student (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
  school        VARCHAR(4)  NOT NULL COMMENT '学校: GP/MS',
  sex           VARCHAR(1)  NOT NULL COMMENT '性别: F/M',
  age           TINYINT     NOT NULL COMMENT '年龄 15-22',
  address       VARCHAR(1)  NOT NULL COMMENT '住址: U城市/R农村',
  famsize       VARCHAR(3)  NOT NULL COMMENT '家庭规模: LE3/GT3',
  p_status      VARCHAR(1)  NOT NULL COMMENT '父母同居状态: T/A',
  medu          TINYINT     NOT NULL COMMENT '母亲学历 0-4',
  fedu          TINYINT     NOT NULL COMMENT '父亲学历 0-4',
  mjob          VARCHAR(10) NOT NULL COMMENT '母亲职业',
  fjob          VARCHAR(10) NOT NULL COMMENT '父亲职业',
  reason        VARCHAR(12) NOT NULL COMMENT '择校原因',
  guardian      VARCHAR(6)  NOT NULL COMMENT '监护人',
  traveltime    TINYINT     NOT NULL COMMENT '通勤时间等级 1-4',
  studytime     TINYINT     NOT NULL COMMENT '周学习时间等级 1-4',
  failures      TINYINT     NOT NULL COMMENT '历史不及格次数 0-4',
  schoolsup     TINYINT     NOT NULL COMMENT '课外辅导 1/0',
  famsup        TINYINT     NOT NULL COMMENT '家庭支持 1/0',
  paid          TINYINT     NOT NULL COMMENT '付费补课 1/0',
  activities    TINYINT     NOT NULL COMMENT '课外活动 1/0',
  nursery       TINYINT     NOT NULL COMMENT '上过幼儿园 1/0',
  higher        TINYINT     NOT NULL COMMENT '想上高等教育 1/0',
  internet      TINYINT     NOT NULL COMMENT '家里有网 1/0',
  romantic      TINYINT     NOT NULL COMMENT '恋爱中 1/0',
  famrel        TINYINT     NOT NULL COMMENT '家庭关系 1-5',
  freetime      TINYINT     NOT NULL COMMENT '自由时间 1-5',
  goout         TINYINT     NOT NULL COMMENT '外出频率 1-5',
  dalc          TINYINT     NOT NULL COMMENT '工作日饮酒 1-5',
  walc          TINYINT     NOT NULL COMMENT '周末饮酒 1-5',
  health        TINYINT     NOT NULL COMMENT '健康状况 1-5',
  student_key   VARCHAR(128) NOT NULL COMMENT '业务唯一键(科目-行号)',
  person_key    VARCHAR(128) NULL COMMENT '人员识别键(13个属性拼接), 用于跨科目关联同一人',
  UNIQUE KEY uk_student_key (student_key),
  KEY idx_person_key (person_key)
) ENGINE=InnoDB COMMENT='学生信息表';

-- ------------------------------------------------------------
-- 2. 成绩表（一门课一条记录, 数学/葡语各一条）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS score (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
  student_id   BIGINT      NOT NULL COMMENT '关联 student.id',
  course       VARCHAR(4)  NOT NULL COMMENT '科目: math/por',
  g1           TINYINT     NOT NULL COMMENT '第一期成绩 0-20',
  g2           TINYINT     NOT NULL COMMENT '第二期成绩 0-20',
  g3           TINYINT     NOT NULL COMMENT '期末成绩 0-20 (分析目标)',
  absences     TINYINT     NOT NULL COMMENT '缺勤次数',
  is_withdrawn TINYINT     NOT NULL DEFAULT 0 COMMENT '缺考标记: 1=G3为0',
  pass_g3      TINYINT     NOT NULL DEFAULT 0 COMMENT '是否通过: G3>=10',
  grade        VARCHAR(1)  NOT NULL COMMENT '等级: A/B/C/D/F/W',
  improvement  INT         NOT NULL COMMENT 'G3-G2 进步幅度',
  high_absence TINYINT     NOT NULL DEFAULT 0 COMMENT '高缺勤标记: >20',
  UNIQUE KEY uk_student_course (student_id, course),
  KEY idx_course_g3 (course, g3),
  CONSTRAINT fk_score_student FOREIGN KEY (student_id)
    REFERENCES student(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='成绩事实表';

-- ------------------------------------------------------------
-- 3. 常用查询示例（后端接口可以直接参考）
-- ------------------------------------------------------------
-- 各科目成绩分布
-- SELECT course, grade, COUNT(*) FROM score GROUP BY course, grade;

-- 学习时间与及格率
-- SELECT s.studytime, sc.course, AVG(sc.pass_g3) AS pass_rate
-- FROM score sc JOIN student s ON s.id = sc.student_id
-- WHERE sc.is_withdrawn = 0
-- GROUP BY s.studytime, sc.course;
