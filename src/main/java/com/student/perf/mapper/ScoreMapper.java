package com.student.perf.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.student.perf.pojo.Score;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface ScoreMapper extends BaseMapper<Score> {
}
