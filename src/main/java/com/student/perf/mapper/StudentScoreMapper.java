package com.student.perf.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.student.perf.pojo.HeatStat;
import com.student.perf.pojo.ScoreStats;
import com.student.perf.pojo.StudentScore;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 学生成绩 Mapper
 * 继承 BaseMapper 后自动获得: selectPage/selectList/insert/update/delete...
 * 只有聚合统计需要自己写 SQL(@Select 注解方式, 不用 XML)
 */
@Mapper
public interface StudentScoreMapper extends BaseMapper<StudentScore> {

    /** 总览: 按科目统计人数/均分/及格率 */
    @Select("SELECT course AS label, course, COUNT(*) AS cnt, " +
            "ROUND(AVG(g3),2) AS avgG3, " +
            "ROUND(SUM(pass_g3)/COUNT(*),4) AS passRate, " +
            "ROUND(AVG(absences),2) AS avgAbsences " +
            "FROM score GROUP BY course")
    List<ScoreStats> selectOverview();

    /** 等级分布: 每个科目各等级(A-F/W)的人数, 大屏柱状图用 */
    @Select("SELECT grade AS label, course, COUNT(*) AS cnt " +
            "FROM score GROUP BY course, grade")
    List<ScoreStats> selectGradeDistribution();

    /** 分数段分布: 把 G3 分 5 段统计, 看成绩结构(剔除缺考) */
    @Select("SELECT CASE " +
            "WHEN g3 <= 5 THEN '0-5分' " +
            "WHEN g3 <= 9 THEN '6-9分' " +
            "WHEN g3 <= 13 THEN '10-13分' " +
            "WHEN g3 <= 16 THEN '14-16分' " +
            "ELSE '17-20分' END AS label, " +
            "course, COUNT(*) AS cnt, ROUND(AVG(g3),2) AS avgG3 " +
            "FROM score WHERE is_withdrawn = 0 " +
            "GROUP BY label, course ORDER BY MIN(g3)")
    List<ScoreStats> selectScoreDistribution();

    /** 缺勤次数与成绩/及格率的关系(分区间) */
    @Select("SELECT CASE " +
            "WHEN absences = 0 THEN '0次' " +
            "WHEN absences <= 5 THEN '1-5次' " +
            "WHEN absences <= 10 THEN '6-10次' " +
            "WHEN absences <= 20 THEN '11-20次' " +
            "ELSE '20次以上' END AS label, " +
            "course, COUNT(*) AS cnt, ROUND(AVG(g3),2) AS avgG3, " +
            "ROUND(SUM(pass_g3)/COUNT(*),4) AS passRate " +
            "FROM score WHERE is_withdrawn = 0 " +
            "GROUP BY label, course ORDER BY MIN(absences)")
    List<ScoreStats> selectAbsenceImpact();

    /** 热力图: 学习时间 x 外出频率 -> 期末均分(两科合并) */
    @Select("SELECT studytime AS x, goout AS y, " +
            "ROUND(AVG(g3),2) AS value, COUNT(*) AS cnt " +
            "FROM v_student_score WHERE is_withdrawn = 0 " +
            "GROUP BY studytime, goout ORDER BY studytime, goout")
    List<HeatStat> selectHeatmap();

    /**
     * 分组分析: groupCol 由 Service 层白名单校验后传入
     * 这里用 ${} 拼接(列名不能用 #{} 占位), 安全性靠白名单保证
     */
    @Select("SELECT ${groupCol} AS label, course, COUNT(*) AS cnt, " +
            "ROUND(AVG(g3),2) AS avgG3, " +
            "ROUND(SUM(pass_g3)/COUNT(*),4) AS passRate " +
            "FROM v_student_score " +
            "WHERE is_withdrawn = 0 " +
            "GROUP BY ${groupCol}, course ORDER BY label")
    List<ScoreStats> selectGroup(@Param("groupCol") String groupCol);
}
