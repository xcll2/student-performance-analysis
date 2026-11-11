package com.student.perf.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.student.perf.common.Result;
import com.student.perf.mapper.ScoreMapper;
import com.student.perf.mapper.StudentMapper;
import com.student.perf.mapper.StudentScoreMapper;
import com.student.perf.pojo.Score;
import com.student.perf.pojo.Student;
import com.student.perf.pojo.StudentForm;
import com.student.perf.pojo.StudentScore;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * 学生成绩列表 + 增删改接口
 * 查询走视图 v_student_score(只读), 增删改落到 student / score 两张源表
 * 测试: http://localhost:8080/api/students?page=1&size=10&course=math&sex=F
 */
@RestController
@RequestMapping("/api/students")
public class StudentController {

    private final StudentScoreMapper mapper;
    private final StudentMapper studentMapper;
    private final ScoreMapper scoreMapper;

    // 构造器注入(推荐写法, 比 @Autowired 字段注入更利于测试)
    public StudentController(StudentScoreMapper mapper,
                             StudentMapper studentMapper,
                             ScoreMapper scoreMapper) {
        this.mapper = mapper;
        this.studentMapper = studentMapper;
        this.scoreMapper = scoreMapper;
    }

    /* ==================== 查询 ==================== */

    /**
     * 分页 + 条件 + 关键字查询
     * 不传条件参数就是查全部, 传了就动态拼接 WHERE
     */
    @GetMapping
    public Result<Page<StudentScore>> list(
            @RequestParam(defaultValue = "1") int page,     // 页码, 从1开始
            @RequestParam(defaultValue = "10") int size,    // 每页条数
            @RequestParam(required = false) String course,  // 科目 math/por
            @RequestParam(required = false) String sex,     // 性别 F/M
            @RequestParam(required = false) String grade,   // 等级 A~F/W
            @RequestParam(required = false) String keyword, // 关键字: 学校/住址/监护人/职业/科目
            @RequestParam(required = false) Integer g3Min,  // 期末成绩下限
            @RequestParam(required = false) Integer g3Max) {// 期末成绩上限

        // 1. 分页对象
        Page<StudentScore> p = new Page<>(page, size);

        // 2. 条件构造器: 参数传了才加 WHERE 条件
        LambdaQueryWrapper<StudentScore> wrapper = new LambdaQueryWrapper<StudentScore>()
                .eq(course != null && !course.isEmpty(), StudentScore::getCourse, course)
                .eq(sex != null && !sex.isEmpty(), StudentScore::getSex, sex)
                .eq(grade != null && !grade.isEmpty(), StudentScore::getGrade, grade)
                .ge(g3Min != null, StudentScore::getG3, g3Min)
                .le(g3Max != null, StudentScore::getG3, g3Max)
                // 关键字: 对学校/住址/监护人/父母职业/科目做模糊匹配
                .and(keyword != null && !keyword.isEmpty(), w -> w
                        .like(StudentScore::getSchool, keyword)
                        .or().like(StudentScore::getAddress, keyword)
                        .or().like(StudentScore::getGuardian, keyword)
                        .or().like(StudentScore::getMjob, keyword)
                        .or().like(StudentScore::getFjob, keyword)
                        .or().like(StudentScore::getCourse, keyword))
                .orderByAsc(StudentScore::getId);

        // 3. 一行代码完成 分页+条件查询, SQL 由 MP 自动生成
        return Result.ok(mapper.selectPage(p, wrapper));
    }

    /** 单条详情: http://localhost:8080/api/students/1 */
    @GetMapping("/{id}")
    public Result<StudentScore> detail(@PathVariable Long id) {
        return Result.ok(mapper.selectById(id));
    }

    /* ==================== 新增 ==================== */

    /**
     * 新增一条成绩记录: student 表插一行(或复用) + score 表插一行
     * 请求体 JSON 见 StudentForm
     */
    @PostMapping
    @Transactional
    public Result<?> add(@RequestBody StudentForm f) {
        String err = validate(f);
        if (err != null) return Result.error(err);

        // 1. 学生表插一行; 新数据的识别键用随机串, 避免和清洗生成的 key 冲突
        Student s = new Student();
        applyStudent(s, f);
        String key = "usr-" + UUID.randomUUID().toString().substring(0, 12);
        s.setStudentKey(key);
        s.setPersonKey(key);
        studentMapper.insert(s);

        // 2. 成绩表插一行, 派生字段(等级/及格/缺考标记)服务端统一计算
        Score sc = new Score();
        applyScore(sc, f);
        sc.setStudentId(s.getId());
        scoreMapper.insert(sc);

        return Result.ok(sc.getId());
    }

    /* ==================== 修改 ==================== */

    /**
     * 编辑一条成绩记录(id = score.id)
     * 同步更新对应学生行的属性字段
     */
    @PutMapping("/{id}")
    @Transactional
    public Result<?> update(@PathVariable Long id, @RequestBody StudentForm f) {
        String err = validate(f);
        if (err != null) return Result.error(err);

        Score sc = scoreMapper.selectById(id);
        if (sc == null) return Result.error("成绩记录不存在: id=" + id);
        Student s = studentMapper.selectById(sc.getStudentId());
        if (s == null) return Result.error("关联学生不存在");

        applyStudent(s, f);
        studentMapper.updateById(s);
        applyScore(sc, f);
        scoreMapper.updateById(sc);
        return Result.ok("success");
    }

    /* ==================== 删除 ==================== */

    /**
     * 删除一条成绩记录(id = score.id)
     * 如果该学生在两门课的记录都被删光, 一并删除学生行
     */
    @DeleteMapping("/{id}")
    @Transactional
    public Result<?> delete(@PathVariable Long id) {
        Score sc = scoreMapper.selectById(id);
        if (sc == null) return Result.error("成绩记录不存在: id=" + id);

        scoreMapper.deleteById(id);
        Long remain = scoreMapper.selectCount(
                new LambdaQueryWrapper<Score>().eq(Score::getStudentId, sc.getStudentId()));
        if (remain == null || remain == 0) {
            studentMapper.deleteById(sc.getStudentId());
        }
        return Result.ok("success");
    }

    /* ==================== 私有工具 ==================== */

    /** JDK8 没有 Set.of, 用 HashSet 封装枚举白名单 */
    private static Set<String> set(String... items) {
        return new HashSet<>(Arrays.asList(items));
    }

    private static final Set<String> COURSES = set("math", "por");
    private static final Set<String> SEXES = set("F", "M");
    private static final Set<String> SCHOOLS = set("GP", "MS");
    private static final Set<String> ADDRESSES = set("U", "R");
    private static final Set<String> FAMSIZES = set("LE3", "GT3");
    private static final Set<String> GUARDIANS = set("mother", "father", "other");
    private static final Set<String> JOBS = set("at_home", "health", "services", "teacher", "other", "unknown");
    private static final Set<Integer> BINARY = new HashSet<>(Arrays.asList(0, 1));

    /** 表单校验, 返回 null 表示通过, 否则返回错误提示 */
    private String validate(StudentForm f) {
        if (f == null) return "请求体不能为空";
        if (!COURSES.contains(f.getCourse())) return "科目必须是 math 或 por";
        if (!SEXES.contains(f.getSex())) return "性别必须是 F 或 M";
        if (!SCHOOLS.contains(f.getSchool())) return "学校必须是 GP 或 MS";
        if (!ADDRESSES.contains(f.getAddress())) return "住址必须是 U(城市) 或 R(农村)";
        if (!FAMSIZES.contains(f.getFamsize())) return "家庭规模必须是 LE3 或 GT3";
        if (!GUARDIANS.contains(f.getGuardian())) return "监护人必须是 mother/father/other";
        if (!JOBS.contains(f.getMjob())) return "母亲职业取值不合法";
        if (!JOBS.contains(f.getFjob())) return "父亲职业取值不合法";
        if (f.getAge() == null || f.getAge() < 15 || f.getAge() > 22) return "年龄必须在 15-22 之间";
        for (String name : new String[]{"g1", "g2", "g3"}) {
            Integer v = name.equals("g1") ? f.getG1() : name.equals("g2") ? f.getG2() : f.getG3();
            if (v == null || v < 0 || v > 20) return "成绩 " + name.toUpperCase() + " 必须在 0-20 之间";
        }
        if (f.getAbsences() == null || f.getAbsences() < 0 || f.getAbsences() > 93)
            return "缺勤次数必须在 0-93 之间";
        if (f.getMedu() == null || f.getMedu() < 0 || f.getMedu() > 4) return "母亲学历必须在 0-4 之间";
        if (f.getFedu() == null || f.getFedu() < 0 || f.getFedu() > 4) return "父亲学历必须在 0-4 之间";
        if (f.getStudytime() == null || f.getStudytime() < 1 || f.getStudytime() > 4) return "学习时间等级必须是 1-4";
        if (f.getTraveltime() == null || f.getTraveltime() < 1 || f.getTraveltime() > 4) return "通勤时间等级必须是 1-4";
        if (f.getFailures() == null || f.getFailures() < 0 || f.getFailures() > 4) return "不及格次数必须在 0-4 之间";
        for (Integer v : new Integer[]{f.getGoout(), f.getDalc(), f.getWalc(), f.getFreetime(), f.getHealth()}) {
            if (v == null || v < 1 || v > 5) return "外出/饮酒/自由时间/健康等级必须是 1-5";
        }
        if (!BINARY.contains(f.getRomantic())) return "恋爱状态必须是 0 或 1";
        if (!BINARY.contains(f.getHigher())) return "是否想升学必须是 0 或 1";
        return null;
    }

    /** 把表单字段铺到 Student 实体(新增/编辑通用), 表单没覆盖的列给默认值 */
    private void applyStudent(Student s, StudentForm f) {
        s.setSchool(f.getSchool());
        s.setSex(f.getSex());
        s.setAge(f.getAge());
        s.setAddress(f.getAddress());
        s.setFamsize(f.getFamsize());
        if (s.getPStatus() == null) s.setPStatus("T");
        s.setMedu(f.getMedu());
        s.setFedu(f.getFedu());
        s.setMjob(f.getMjob());
        s.setFjob(f.getFjob());
        if (s.getReason() == null) s.setReason("home");
        s.setGuardian(f.getGuardian());
        s.setTraveltime(f.getTraveltime());
        s.setStudytime(f.getStudytime());
        s.setFailures(f.getFailures());
        if (s.getSchoolsup() == null) s.setSchoolsup(0);
        if (s.getFamsup() == null) s.setFamsup(0);
        if (s.getPaid() == null) s.setPaid(0);
        if (s.getActivities() == null) s.setActivities(0);
        if (s.getNursery() == null) s.setNursery(1);
        s.setHigher(f.getHigher());
        if (s.getInternet() == null) s.setInternet(1);
        s.setRomantic(f.getRomantic());
        if (s.getFamrel() == null) s.setFamrel(3);
        s.setFreetime(f.getFreetime());
        s.setGoout(f.getGoout());
        s.setDalc(f.getDalc());
        s.setWalc(f.getWalc());
        s.setHealth(f.getHealth());
    }

    /** 成绩字段 + 派生字段计算(与数据清洗口径完全一致) */
    private void applyScore(Score sc, StudentForm f) {
        sc.setCourse(f.getCourse());
        sc.setG1(f.getG1());
        sc.setG2(f.getG2());
        sc.setG3(f.getG3());
        sc.setAbsences(f.getAbsences());
        sc.setIsWithdrawn(f.getG3() == 0 ? 1 : 0);
        sc.setPassG3(f.getG3() >= 10 ? 1 : 0);
        sc.setGrade(gradeOf(f.getG3()));
        sc.setImprovement(f.getG3() - f.getG2());
        sc.setHighAbsence(f.getAbsences() > 20 ? 1 : 0);
    }

    /** 等级规则与 preprocess.py 保持一致: W(缺考) A>=16 B>=14 C>=12 D>=10 其余F */
    private String gradeOf(int g) {
        if (g == 0) return "W";
        if (g >= 16) return "A";
        if (g >= 14) return "B";
        if (g >= 12) return "C";
        if (g >= 10) return "D";
        return "F";
    }
}
