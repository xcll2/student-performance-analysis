package com.student.perf.pojo;

import lombok.Data;

/**
 * 新增 / 编辑表单 DTO
 * 前端提交的学生 + 成绩字段, 服务端校验后拆成 student + score 两行落库
 */
@Data
public class StudentForm {

    // ---- 成绩 ----
    private String course;      // math / por
    private Integer g1;
    private Integer g2;
    private Integer g3;
    private Integer absences;

    // ---- 学生基本 ----
    private String school;      // GP / MS
    private String sex;         // F / M
    private Integer age;
    private String address;     // U / R
    private String famsize;     // LE3 / GT3
    private String guardian;    // mother / father / other

    // ---- 家庭背景 ----
    private Integer medu;       // 0-4
    private Integer fedu;       // 0-4
    private String mjob;
    private String fjob;

    // ---- 行为习惯 ----
    private Integer studytime;  // 1-4
    private Integer traveltime; // 1-4
    private Integer failures;   // 0-4
    private Integer goout;      // 1-5
    private Integer dalc;       // 1-5
    private Integer walc;       // 1-5
    private Integer freetime;   // 1-5
    private Integer health;     // 1-5
    private Integer romantic;   // 0/1
    private Integer higher;     // 0/1
}
