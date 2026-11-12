package com.student.perf.controller;

import com.student.perf.common.Result;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 作品集大屏专用画像接口.
 *
 * 提供"按科目"的聚合口径, 供袁正勇(六页导航大屏)与杨佳乐(课程标签大屏)两个作品使用.
 * 四套 KPI 与三类分部数据一次返回, 前端切标签/切页时只需重新拉这一个接口.
 *
 * 口径说明(与作业截图保持一致):
 *   - 均分/及格率按全部记录计算, 缺考(g3=0)计入分母, 因此会低于只算有效成绩的口径
 *   - 及格线 G3 >= 10
 *   - "缺勤异常"指一学期缺勤次数 > 30
 */
@RestController
@RequestMapping("/api/dash")
public class DashboardController {

    private final JdbcTemplate jdbc;

    public DashboardController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** course 参数白名单: all / math / por */
    private String where(String course) {
        if (course == null || course.isEmpty() || "all".equals(course)) {
            return " WHERE 1=1 ";
        }
        if (!"math".equals(course) && !"por".equals(course)) {
            throw new IllegalArgumentException("course 只能是 all / math / por");
        }
        return " WHERE course = '" + course + "' ";
    }

    /**
     * 分科画像: /api/dash/profile?course=math
     * 返回 kpi / seg4 / seg5 / studyDist / studyAvg / gradeByCourse
     */
    @GetMapping("/profile")
    public Result<?> profile(@RequestParam(defaultValue = "all") String course) {
        String w = where(course);

        // 1. 四项基础 KPI + 缺勤异常人数
        Map<String, Object> kpi = jdbc.queryForMap(
                "SELECT COUNT(*) AS cnt, " +
                "ROUND(AVG(g3),2) AS avgG3, " +
                "ROUND(SUM(pass_g3)/COUNT(*)*100,1) AS passRate, " +
                "ROUND(AVG(studytime),2) AS avgStudy, " +
                "SUM(CASE WHEN absences > 30 THEN 1 ELSE 0 END) AS highAbsent " +
                "FROM v_student_score " + w);

        // 2. 两门课均分差(葡语 - 数学), 与当前筛选无关, 固定口径
        Map<String, Object> gapRow = jdbc.queryForMap(
                "SELECT ROUND(MAX(CASE WHEN course='por' THEN a END) " +
                "- MAX(CASE WHEN course='math' THEN a END),2) AS gap FROM (" +
                "SELECT course, AVG(g3) a FROM v_student_score GROUP BY course) t");
        kpi.put("gap", gapRow.get("gap"));

        // 3. 分数段: 四段(期末成绩分段分布) 与 五段(成绩档次构成环形图)
        List<Map<String, Object>> seg4 = jdbc.queryForList(
                "SELECT CASE WHEN g3<=4 THEN '0-4分' WHEN g3<=9 THEN '5-9分' " +
                "WHEN g3<=14 THEN '10-14分' ELSE '15-20分' END AS label, " +
                "COUNT(*) AS cnt, ROUND(AVG(g3),2) AS avgG3 " +
                "FROM v_student_score " + w + " GROUP BY label ORDER BY MIN(g3)");
        List<Map<String, Object>> seg5 = jdbc.queryForList(
                "SELECT CASE WHEN g3<=4 THEN '0-4分' WHEN g3<=9 THEN '5-9分' " +
                "WHEN g3<=14 THEN '10-14分' WHEN g3<=17 THEN '15-17分' ELSE '18-20分' END AS label, " +
                "COUNT(*) AS cnt FROM v_student_score " + w + " GROUP BY label ORDER BY MIN(g3)");

        // 4. 每周学习时长档人数(环形图)
        List<Map<String, Object>> studyDist = jdbc.queryForList(
                "SELECT studytime AS level, COUNT(*) AS cnt FROM v_student_score " + w +
                " GROUP BY studytime ORDER BY studytime");

        // 5. 学习时长档 x 科目 的均分/及格率(分组柱状图, 始终返回两科便于对比)
        List<Map<String, Object>> studyAvg = jdbc.queryForList(
                "SELECT studytime AS level, course, COUNT(*) AS cnt, " +
                "ROUND(AVG(g3),2) AS avgG3, ROUND(SUM(pass_g3)/COUNT(*)*100,1) AS passRate " +
                "FROM v_student_score GROUP BY studytime, course ORDER BY studytime, course");

        // 6. 等级 x 科目(堆叠柱状图)
        List<Map<String, Object>> gradeByCourse = jdbc.queryForList(
                "SELECT course, grade, COUNT(*) AS cnt FROM v_student_score " + w +
                " GROUP BY course, grade ORDER BY course, grade");

        // 7. 缺勤区间 x 科目(第 2 页"学习时间专题"用)
        List<Map<String, Object>> absentDist = jdbc.queryForList(
                "SELECT CASE WHEN absences=0 THEN '0次' WHEN absences<=5 THEN '1-5次' " +
                "WHEN absences<=10 THEN '6-10次' WHEN absences<=20 THEN '11-20次' ELSE '20次以上' END AS label, " +
                "course, COUNT(*) AS cnt, ROUND(AVG(g3),2) AS avgG3, " +
                "ROUND(SUM(pass_g3)/COUNT(*)*100,1) AS passRate " +
                "FROM v_student_score WHERE is_withdrawn = 0 " +
                "GROUP BY label, course ORDER BY MIN(absences), course");

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("course", course);
        data.put("kpi", kpi);
        data.put("seg4", seg4);
        data.put("seg5", seg5);
        data.put("studyDist", studyDist);
        data.put("studyAvg", studyAvg);
        data.put("gradeByCourse", gradeByCourse);
        data.put("absentDist", absentDist);
        return Result.ok(data);
    }

    /**
     * 影响因素相关性: /api/dash/corr
     * 直接对视图逐行取数, 在应用层算皮尔逊相关系数(MySQL 没有内置 CORR 函数)
     */
    @GetMapping("/corr")
    public Result<?> corr() {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT g1, g2, g3, studytime, absences, goout, failures, medu, fedu, health, traveltime FROM v_student_score");
        String[] labels = {"G1 第一次平时成绩", "G2 第二次平时成绩", "既往不及格次数", "母亲学历",
                "父亲学历", "每周学习时间", "外出频率", "缺勤次数", "健康自评", "通勤时间"};
        String[] cols = {"g1", "g2", "failures", "medu", "fedu", "studytime", "goout", "absences", "health", "traveltime"};

        int n = rows.size();
        double[] g3 = new double[n];
        for (int i = 0; i < n; i++) {
            g3[i] = num(rows.get(i).get("g3"));
        }
        List<Map<String, Object>> list = new ArrayList<Map<String, Object>>();
        for (int k = 0; k < cols.length; k++) {
            double[] x = new double[n];
            for (int i = 0; i < n; i++) {
                x[i] = num(rows.get(i).get(cols[k]));
            }
            Map<String, Object> m = new LinkedHashMap<String, Object>();
            m.put("label", labels[k]);
            m.put("r", Math.round(pearson(x, g3) * 1000) / 1000.0);
            list.add(m);
        }
        return Result.ok(list);
    }

    /** 全部学生明细(供第 6 页"数据明细"做前端筛选与导出) */
    @GetMapping("/all")
    public Result<?> all() {
        return Result.ok(jdbc.queryForList(
                "SELECT id, course, school, sex, age, address, studytime, failures, absences, " +
                "g1, g2, g3, grade, pass_g3 FROM v_student_score ORDER BY id"));
    }

    private static double num(Object o) {
        if (o == null) return 0;
        return Double.parseDouble(String.valueOf(o));
    }

    private static double pearson(double[] x, double[] y) {
        int n = x.length;
        double mx = 0, my = 0;
        for (int i = 0; i < n; i++) {
            mx += x[i];
            my += y[i];
        }
        mx /= n;
        my /= n;
        double num = 0, dx = 0, dy = 0;
        for (int i = 0; i < n; i++) {
            num += (x[i] - mx) * (y[i] - my);
            dx += (x[i] - mx) * (x[i] - mx);
            dy += (y[i] - my) * (y[i] - my);
        }
        if (dx == 0 || dy == 0) return 0;
        return num / Math.sqrt(dx * dy);
    }

    /** 供调试: 打印可用 course 取值 */
    @GetMapping("/options")
    public Result<?> options() {
        return Result.ok(Arrays.asList("all", "math", "por"));
    }
}
