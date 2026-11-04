package com.student.perf.pojo;

import lombok.Data;

/**
 * 统计结果实体: 总览(overview)和分组分析(group)共用
 */
@Data
public class ScoreStats {
    private String label;       // 分组名: sex 时是 F/M, studytime 时是 1-4 ...
    private String course;      // 科目 math/por
    private Integer cnt;        // 人数
    private Double avgG3;       // 期末均分
    private Double passRate;    // 及格率 0~1
    private Double avgAbsences; // 平均缺勤(总览用)
}
