package com.student.perf.pojo;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/**
 * 学生成绩视图实体（对应数据库视图 v_student_score）
 * 视图 = student 表 JOIN score 表的只读查询, 所以 MP 当普通单表用,
 * 分页/条件筛选全部自动生成, 不用写一行 SQL
 */
@Data
@TableName("v_student_score")
public class StudentScore {

    @TableId
    private Long id;            // score.id

    // ---- 成绩 ----
    private Long studentId;
    private String course;      // 科目 math/por
    private Integer g1;         // 第一期成绩
    private Integer g2;         // 第二期成绩
    private Integer g3;         // 期末成绩(分析目标)
    private Integer absences;   // 缺勤次数
    private Integer isWithdrawn;// 1=缺考(G3=0)
    private Integer passG3;     // 1=及格(G3>=10)
    private String grade;       // A/B/C/D/F/W
    private Integer improvement;// G3-G2 进步幅度
    private Integer highAbsence;// 1=高缺勤(>20次)

    // ---- 学生基本 ----
    private String school;      // GP / MS
    private String sex;
    private Integer age;
    private String address;     // U=城市 R=农村
    private String guardian;
    private String famsize;     // LE3 / GT3
    private String personKey;   // 人员识别键: 同一学生的两门课记录此值相同

    // ---- 家庭背景 ----
    private Integer medu;       // 母亲学历 0-4
    private Integer fedu;       // 父亲学历 0-4
    private String mjob;        // 母亲职业
    private String fjob;        // 父亲职业

    // ---- 行为习惯(分组分析维度) ----
    private Integer studytime;  // 周学习时间 1-4
    private Integer traveltime; // 通勤 1-4
    private Integer failures;   // 历史不及格次数
    private Integer goout;      // 外出频率 1-5
    private Integer dalc;       // 工作日饮酒 1-5
    private Integer walc;       // 周末饮酒 1-5
    private Integer freetime;   // 自由时间 1-5
    private Integer health;     // 健康 1-5
    private Integer romantic;   // 恋爱 1/0
    private Integer higher;     // 想升学 1/0
}
