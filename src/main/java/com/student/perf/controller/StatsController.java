package com.student.perf.controller;

import com.student.perf.common.Result;
import com.student.perf.mapper.StudentScoreMapper;
import com.student.perf.pojo.ScoreStats;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

/**
 * 统计分析接口(给前端 ECharts 画图用)
 */
@RestController
@RequestMapping("/api/stats")
public class StatsController {

    private final StudentScoreMapper mapper;

    public StatsController(StudentScoreMapper mapper) {
        this.mapper = mapper;
    }

    /**
     * 分组维度白名单: key=前端传的 by 参数, value=数据库列名
     * 只有在这个表里的值才允许拼进 SQL, 防止 SQL 注入
     */
    private static final Map<String, String> GROUP_COLUMNS = new HashMap<>();

    static {
        GROUP_COLUMNS.put("sex", "sex");               // 性别
        GROUP_COLUMNS.put("address", "address");       // 城市/农村
        GROUP_COLUMNS.put("studytime", "studytime");   // 周学习时间
        GROUP_COLUMNS.put("goout", "goout");           // 外出频率
        GROUP_COLUMNS.put("dalc", "dalc");             // 工作日饮酒
        GROUP_COLUMNS.put("walc", "walc");             // 周末饮酒
        GROUP_COLUMNS.put("romantic", "romantic");     // 恋爱
        GROUP_COLUMNS.put("higher", "higher");         // 想升学
        GROUP_COLUMNS.put("freetime", "freetime");     // 自由时间
        GROUP_COLUMNS.put("health", "health");         // 健康
        GROUP_COLUMNS.put("medu", "medu");             // 母亲学历
        GROUP_COLUMNS.put("fedu", "fedu");             // 父亲学历
        GROUP_COLUMNS.put("school", "school");         // 学校
        GROUP_COLUMNS.put("famsize", "famsize");       // 家庭规模
        GROUP_COLUMNS.put("failures", "failures");     // 历史不及格次数
    }

    /** 总览: http://localhost:8080/api/stats/overview */
    @GetMapping("/overview")
    public Result<?> overview() {
        return Result.ok(mapper.selectOverview());
    }

    /** 等级分布: http://localhost:8080/api/stats/grades */
    @GetMapping("/grades")
    public Result<?> grades() {
        return Result.ok(mapper.selectGradeDistribution());
    }

    /** 分数段分布: http://localhost:8080/api/stats/distribution */
    @GetMapping("/distribution")
    public Result<?> distribution() {
        return Result.ok(mapper.selectScoreDistribution());
    }

    /** 缺勤影响: http://localhost:8080/api/stats/absences */
    @GetMapping("/absences")
    public Result<?> absences() {
        return Result.ok(mapper.selectAbsenceImpact());
    }

    /** 热力图(学习时间 x 外出频率): http://localhost:8080/api/stats/heatmap */
    @GetMapping("/heatmap")
    public Result<?> heatmap() {
        return Result.ok(mapper.selectHeatmap());
    }

    /**
     * 分组分析: http://localhost:8080/api/stats/group?by=studytime
     * 返回每个维度取值 x 科目 的均分/及格率, 前端直接喂给 ECharts
     */
    @GetMapping("/group")
    public Result<?> group(@RequestParam String by) {
        String col = GROUP_COLUMNS.get(by);
        if (col == null) {
            return Result.error("不支持的分组维度: " + by + ", 可选: " + GROUP_COLUMNS.keySet());
        }
        return Result.ok(mapper.selectGroup(col));
    }
}
