package com.student.perf.pojo;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/**
 * 成绩实体（对应 score 表, 可增删改）
 */
@Data
@TableName("score")
public class Score {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long studentId;     // 关联 student.id
    private String course;      // math / por
    private Integer g1;         // 第一期 0-20
    private Integer g2;         // 第二期 0-20
    private Integer g3;         // 期末 0-20
    private Integer absences;   // 缺勤次数
    private Integer isWithdrawn;// 1=缺考(G3=0)
    private Integer passG3;     // 1=及格(G3>=10)
    private String grade;       // A/B/C/D/F/W
    private Integer improvement;// G3-G2
    private Integer highAbsence;// 1=高缺勤(>20)
}
