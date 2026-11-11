package com.student.perf.pojo;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/**
 * 学生信息实体（对应 student 表, 可增删改）
 */
@Data
@TableName("student")
public class Student {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String school;      // GP / MS
    private String sex;         // F / M
    private Integer age;        // 15-22
    private String address;     // U城市 / R农村
    private String famsize;     // LE3 / GT3
    private String pStatus;     // T父母同居 / A分居
    private Integer medu;       // 母亲学历 0-4
    private Integer fedu;       // 父亲学历 0-4
    private String mjob;
    private String fjob;
    private String reason;      // 择校原因
    private String guardian;    // 监护人
    private Integer traveltime; // 通勤 1-4
    private Integer studytime;  // 周学习时间 1-4
    private Integer failures;   // 历史不及格次数
    private Integer schoolsup;  // 课外辅导 1/0
    private Integer famsup;     // 家庭支持 1/0
    private Integer paid;       // 付费补课 1/0
    private Integer activities; // 课外活动 1/0
    private Integer nursery;    // 幼儿园 1/0
    private Integer higher;     // 想升学 1/0
    private Integer internet;   // 有网 1/0
    private Integer romantic;   // 恋爱 1/0
    private Integer famrel;     // 家庭关系 1-5
    private Integer freetime;   // 自由时间 1-5
    private Integer goout;      // 外出频率 1-5
    private Integer dalc;       // 工作日饮酒 1-5
    private Integer walc;       // 周末饮酒 1-5
    private Integer health;     // 健康 1-5
    private String studentKey;  // 业务唯一键
    private String personKey;   // 跨科目人员识别键
}
