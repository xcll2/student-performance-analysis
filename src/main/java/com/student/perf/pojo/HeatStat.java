package com.student.perf.pojo;

import lombok.Data;

/**
 * 热力图数据点: x=学习时间等级, y=外出频率等级, value=期末均分
 */
@Data
public class HeatStat {
    private Integer x;
    private Integer y;
    private Double value;
    private Integer cnt;
}
