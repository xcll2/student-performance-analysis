/* ==========================================================================
   member-a.js —— 袁正勇作品：六页导航大屏
   数据全部来自 Spring Boot 接口，页面切换时按需渲染，图表实例缓存复用
   ========================================================================== */
(function () {
    "use strict";

    const API = "";
    const charts = {};          // id -> echarts instance
    const S = {};               // 接口数据缓存
    const rendered = {};        // 页面是否已渲染
    let current = 0;

    const PAGE_NAME = ["全局概览", "学习时间专题", "成绩分布", "影响因素", "三维分布", "数据明细"];
    const C = {
        teal: "#2fb0a6", teal2: "#4fd1c5", blue: "#4a8fd6", green: "#35c48e",
        orange: "#e08a3c", red: "#d9534f", purple: "#8b7cd8", gray: "#5d7691",
        txt: "#c5dae7", txt2: "#8fa8bd", line: "rgba(58,124,165,0.25)"
    };

    /* ------------------------------ 基础工具 ------------------------------ */
    async function api(path) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 10000);
        try {
            const res = await fetch(API + path, { signal: ctrl.signal });
            const json = await res.json();
            if (json.code !== 200) throw new Error(json.msg || "接口返回异常");
            return json.data;
        } finally {
            clearTimeout(t);
        }
    }

    function toast(msg) {
        const el = document.getElementById("toast");
        el.textContent = msg;
        el.classList.add("show");
        clearTimeout(el._t);
        el._t = setTimeout(() => el.classList.remove("show"), 2200);
    }

    function mk(id) {
        if (!charts[id]) {
            const dom = document.getElementById(id);
            if (!dom) return null;
            charts[id] = echarts.init(dom);
        }
        return charts[id];
    }

    // 统一的坐标轴样式
    function axis(extra) {
        return Object.assign({
            axisLine: { lineStyle: { color: C.line } },
            axisTick: { show: false },
            axisLabel: { color: C.txt2, fontSize: 10 },
            splitLine: { lineStyle: { color: "rgba(58,124,165,0.10)" } }
        }, extra || {});
    }

    const tip = {
        backgroundColor: "rgba(10,21,38,0.94)",
        borderColor: "rgba(58,124,165,0.45)",
        textStyle: { color: "#dbeaf4", fontSize: 11 },
        extraCssText: "border-radius:4px;box-shadow:0 6px 18px rgba(0,0,0,.45)"
    };

    function grad(c1, c2) {
        return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: c1 }, { offset: 1, color: c2 }
        ]);
    }

    /* ------------------------------ 数据加载 ------------------------------ */
    async function loadData() {
        const [ov, grades, dist, absences, heat, pMath, pPor, corr,
            gFail, gMedu, gFedu, gSex, gAddr, gFam, gHigh, all] = await Promise.all([
            api("/api/stats/overview"),
            api("/api/stats/grades"),
            api("/api/stats/distribution"),
            api("/api/stats/absences"),
            api("/api/stats/heatmap"),
            api("/api/dash/profile?course=math"),
            api("/api/dash/profile?course=por"),
            api("/api/dash/corr"),
            api("/api/stats/group?by=failures"),
            api("/api/stats/group?by=medu"),
            api("/api/stats/group?by=fedu"),
            api("/api/stats/group?by=sex"),
            api("/api/stats/group?by=address"),
            api("/api/stats/group?by=famsize"),
            api("/api/stats/group?by=higher"),
            api("/api/dash/all")
        ]);
        Object.assign(S, {
            ov, grades, dist, absences, heat, pMath, pPor, corr,
            gFail, gMedu, gFedu, gSex, gAddr, gFam, gHigh, all
        });
    }

    /* ------------------------------ 首页 KPI ------------------------------ */
    function renderKpi() {
        const k = S.pMath.kpi;
        document.getElementById("k1").textContent = k.cnt;
        document.getElementById("k2").innerHTML = k.avgG3 + "<small>分</small>";
        document.getElementById("k3").innerHTML = k.passRate + "<small>%</small>";
        document.getElementById("k4").innerHTML = k.avgStudy + "<small>档</small>";
        document.getElementById("k5").innerHTML = k.highAbsent + "<small>人</small>";
        document.getElementById("k6").innerHTML = k.gap + "<small>分</small>";
        document.getElementById("upd").textContent = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    }

    /* ------------------------------ 图 1-1 学习时间档 × 均分 ------------------------------ */
    function chartStudyAvg() {
        const c = mk("c_study_avg"); if (!c) return;
        const rows = S.pMath.studyAvg;
        const levels = [...new Set(rows.map(r => r.level))].sort();
        const label = { 1: "1 档 <2h", 2: "2 档 2-5h", 3: "3 档 5-10h", 4: "4 档 >10h" };
        const pick = (course) => levels.map(lv => {
            const r = rows.find(x => x.level === lv && x.course === course);
            return r ? r.avgG3 : 0;
        });
        c.setOption({
            tooltip: Object.assign({ trigger: "axis", axisPointer: { type: "shadow" } }, tip),
            legend: {
                data: ["数学课", "葡萄牙语课"], right: 8, top: 2,
                itemWidth: 8, itemHeight: 8, itemGap: 12,
                textStyle: { color: C.txt2, fontSize: 10 }
            },
            grid: { left: 44, right: 16, top: 30, bottom: 26 },
            xAxis: axis({ type: "category", data: levels.map(l => label[l]) }),
            yAxis: axis({ type: "value", max: 20, name: "平均分", nameTextStyle: { color: C.txt2, fontSize: 10 }, nameGap: 10 }),
            series: [
                {
                    name: "数学课", type: "bar", barWidth: 26, barGap: "18%",
                    itemStyle: { borderRadius: [2, 2, 0, 0], color: grad("#63aae8", "#2f6fb5") },
                    label: { show: true, position: "top", color: "#9fc6e6", fontSize: 9.5 },
                    data: pick("math")
                },
                {
                    name: "葡萄牙语课", type: "bar", barWidth: 26,
                    itemStyle: { borderRadius: [2, 2, 0, 0], color: grad("#4fd8a4", "#1f8f6a") },
                    label: { show: true, position: "top", color: "#7fd8b6", fontSize: 9.5 },
                    data: pick("por")
                }
            ]
        });
    }

    /* ------------------------------ 图 1-2 成绩档次构成 ------------------------------ */
    function chartSeg5() {
        const c = mk("c_seg5"); if (!c) return;
        const rows = S.pMath.seg5;
        const color = { "0-4分": "#2fb0a6", "5-9分": "#e08a3c", "10-14分": "#4a8fd6", "15-17分": "#35c48e", "18-20分": "#8b7cd8" };
        c.setOption({
            tooltip: Object.assign({ trigger: "item", formatter: "{b}<br/>{c} 人（{d}%）" }, tip),
            legend: {
                orient: "vertical", right: 10, top: "center",
                itemWidth: 8, itemHeight: 8, itemGap: 9,
                textStyle: { color: C.txt2, fontSize: 10 }
            },
            title: {
                text: S.pMath.kpi.cnt + "\n样本",
                left: "36%", top: "44%", textAlign: "center",
                textStyle: { color: "#e6f1f7", fontSize: 17, lineHeight: 21, fontWeight: 600 }
            },
            series: [{
                type: "pie",
                radius: ["52%", "76%"],
                center: ["36%", "50%"],
                avoidLabelOverlap: true,
                itemStyle: { borderColor: "#0b1728", borderWidth: 2 },
                label: { show: false },
                data: rows.map(r => ({
                    name: r.label, value: r.cnt,
                    itemStyle: { color: color[r.label] || C.gray }
                }))
            }]
        });
    }

    /* ------------------------------ 图 2 ------------------------------ */
    function chartStudyCnt() {
        const c = mk("c_study_cnt"); if (!c) return;
        const label = { 1: "<2h", 2: "2-5h", 3: "5-10h", 4: ">10h" };
        const m = [0, 0, 0, 0], p = [0, 0, 0, 0];
        S.pMath.studyDist.forEach(r => m[r.level - 1] = r.cnt);
        S.pPor.studyDist.forEach(r => p[r.level - 1] = r.cnt);
        c.setOption({
            tooltip: Object.assign({ trigger: "axis", axisPointer: { type: "shadow" } }, tip),
            legend: { data: ["数学课", "葡萄牙语课"], right: 8, top: 2, itemWidth: 8, itemHeight: 8, textStyle: { color: C.txt2, fontSize: 10 } },
            grid: { left: 46, right: 16, top: 30, bottom: 26 },
            xAxis: axis({ type: "category", data: [1, 2, 3, 4].map(l => label[l]) }),
            yAxis: axis({ type: "value", name: "人数", nameTextStyle: { color: C.txt2, fontSize: 10 } }),
            series: [
                { name: "数学课", type: "bar", barWidth: 22, barGap: "18%", itemStyle: { borderRadius: [2, 2, 0, 0], color: grad("#63aae8", "#2f6fb5") }, label: { show: true, position: "top", color: "#9fc6e6", fontSize: 9.5 }, data: m },
                { name: "葡萄牙语课", type: "bar", barWidth: 22, itemStyle: { borderRadius: [2, 2, 0, 0], color: grad("#4fd8a4", "#1f8f6a") }, label: { show: true, position: "top", color: "#7fd8b6", fontSize: 9.5 }, data: p }
            ]
        });
    }

    function chartStudyRate() {
        const c = mk("c_study_rate"); if (!c) return;
        const rows = S.pMath.studyAvg.filter(r => r.course === "math").sort((a, b) => a.level - b.level);
        const label = { 1: "<2h", 2: "2-5h", 3: "5-10h", 4: ">10h" };
        c.setOption({
            tooltip: Object.assign({ trigger: "axis" }, tip),
            legend: { data: ["平均分", "及格率"], right: 8, top: 2, itemWidth: 8, itemHeight: 8, textStyle: { color: C.txt2, fontSize: 10 } },
            grid: { left: 44, right: 46, top: 30, bottom: 26 },
            xAxis: axis({ type: "category", data: rows.map(r => label[r.level]) }),
            yAxis: [
                axis({ type: "value", max: 20, name: "平均分", nameTextStyle: { color: C.txt2, fontSize: 10 } }),
                axis({ type: "value", max: 100, splitLine: { show: false }, axisLabel: { color: C.txt2, fontSize: 10, formatter: "{value}%" } })
            ],
            series: [
                { name: "平均分", type: "bar", barWidth: 22, itemStyle: { borderRadius: [2, 2, 0, 0], color: grad("#4fd8a4", "#1f7f66") }, label: { show: true, position: "top", color: "#8fe0c2", fontSize: 9.5 }, data: rows.map(r => r.avgG3) },
                { name: "及格率", type: "line", yAxisIndex: 1, smooth: true, symbolSize: 6, lineStyle: { width: 2, color: C.orange }, itemStyle: { color: C.orange }, data: rows.map(r => r.passRate) }
            ]
        });
    }

    function chartAbsent() {
        const c = mk("c_absent"); if (!c) return;
        const rows = S.absences.filter(r => r.course === "math");
        c.setOption({
            tooltip: Object.assign({ trigger: "axis" }, tip),
            legend: { data: ["及格率", "平均分"], right: 8, top: 2, itemWidth: 8, itemHeight: 8, textStyle: { color: C.txt2, fontSize: 10 } },
            grid: { left: 44, right: 46, top: 30, bottom: 26 },
            xAxis: axis({ type: "category", data: rows.map(r => r.label) }),
            yAxis: [
                axis({ type: "value", max: 100, name: "及格率%", nameTextStyle: { color: C.txt2, fontSize: 10 } }),
                axis({ type: "value", max: 20, splitLine: { show: false }, axisLabel: { color: C.txt2, fontSize: 10 } })
            ],
            series: [
                {
                    name: "及格率", type: "bar", barWidth: 24,
                    itemStyle: {
                        borderRadius: [2, 2, 0, 0],
                        color: (p) => p.dataIndex >= 3 ? grad("#f0a860", "#b4551f") : grad("#5fb4ea", "#2a6bad")
                    },
                    label: { show: true, position: "insideTop", color: "#eaf6ff", fontSize: 9.5, formatter: "{c}%", offset: [0, 5] },
                    data: rows.map(r => +(r.passRate * 100).toFixed(1))
                },
                { name: "平均分", type: "line", yAxisIndex: 1, smooth: true, symbolSize: 6, lineStyle: { width: 2, color: C.teal2 }, itemStyle: { color: C.teal2 }, data: rows.map(r => r.avgG3) }
            ]
        });
    }

    function chartHeat(id, data) {
        const c = mk(id); if (!c) return;
        const xs = [...new Set(data.map(d => d.x))].sort();
        const ys = [...new Set(data.map(d => d.y))].sort();
        const vals = data.map(d => [d.x - 1, d.y - 1, d.value]);
        const max = Math.max(...data.map(d => d.value));
        c.setOption({
            tooltip: Object.assign({
                formatter: (p) => `学习时长 ${p.value[0] + 1} 档<br/>外出频率 ${p.value[1] + 1} 级<br/>均分 <b>${p.value[2]}</b>`
            }, tip),
            grid: { left: 52, right: 20, top: 16, bottom: 46 },
            xAxis: axis({ type: "category", data: xs.map(x => x + " 档"), splitArea: { show: true, areaStyle: { color: ["rgba(0,0,0,0)", "rgba(58,124,165,0.04)"] } } }),
            yAxis: axis({ type: "category", data: ys.map(y => y + " 级"), splitArea: { show: true, areaStyle: { color: ["rgba(0,0,0,0)", "rgba(58,124,165,0.04)"] } } }),
            visualMap: {
                min: Math.min(...data.map(d => d.value)), max: max,
                calculable: false, orient: "horizontal", left: "center", bottom: 2,
                itemWidth: 10, itemHeight: 70,
                textStyle: { color: C.txt2, fontSize: 9 },
                inRange: { color: ["#123252", "#1f6f8f", "#2fb0a6", "#8fe0b0"] }
            },
            series: [{
                type: "heatmap", data: vals,
                label: { show: true, color: "#dff3ff", fontSize: 9 },
                itemStyle: { borderColor: "#0b1728", borderWidth: 1 }
            }]
        });
    }

    /* ------------------------------ 图 3 ------------------------------ */
    function chartGrade() {
        const c = mk("c_grade"); if (!c) return;
        const grades = ["A", "B", "C", "D", "F", "W"];
        const color = { A: "#35c48e", B: "#4a8fd6", C: "#2fb0a6", D: "#e08a3c", F: "#d9534f", W: "#7d8a99" };
        const series = grades.map(g => ({
            name: g, type: "bar", stack: "t", barWidth: 26,
            itemStyle: { color: color[g] },
            emphasis: { focus: "series" },
            label: { show: true, color: "#08121f", fontSize: 9, formatter: (p) => p.value >= 40 ? p.value : "" },
            data: ["math", "por"].map(course => {
                const r = S.grades.find(x => x.course === course && x.label === g);
                return r ? r.cnt : 0;
            })
        }));
        c.setOption({
            tooltip: Object.assign({ trigger: "axis", axisPointer: { type: "shadow" } }, tip),
            legend: { top: 2, right: 8, itemWidth: 8, itemHeight: 8, itemGap: 10, textStyle: { color: C.txt2, fontSize: 10 } },
            grid: { left: 46, right: 16, top: 30, bottom: 26 },
            xAxis: axis({ type: "category", data: ["数学课", "葡萄牙语课"] }),
            yAxis: axis({ type: "value", name: "人数", nameTextStyle: { color: C.txt2, fontSize: 10 } }),
            series: series
        });
    }

    function chartSeg4() {
        const c = mk("c_seg4"); if (!c) return;
        const labels = S.pMath.seg4.map(r => r.label);
        const get = (prof, lb) => { const r = prof.seg4.find(x => x.label === lb); return r ? r.cnt : 0; };
        c.setOption({
            tooltip: Object.assign({ trigger: "axis", axisPointer: { type: "shadow" } }, tip),
            legend: { data: ["数学课", "葡萄牙语课"], right: 8, top: 2, itemWidth: 8, itemHeight: 8, textStyle: { color: C.txt2, fontSize: 10 } },
            grid: { left: 46, right: 16, top: 30, bottom: 26 },
            xAxis: axis({ type: "category", data: labels }),
            yAxis: axis({ type: "value", name: "人数", nameTextStyle: { color: C.txt2, fontSize: 10 } }),
            series: [
                { name: "数学课", type: "bar", barWidth: 20, barGap: "12%", itemStyle: { borderRadius: [2, 2, 0, 0], color: grad("#63aae8", "#2f6fb5") }, label: { show: true, position: "top", color: "#9fc6e6", fontSize: 9.5 }, data: labels.map(l => get(S.pMath, l)) },
                { name: "葡萄牙语课", type: "bar", barWidth: 20, itemStyle: { borderRadius: [2, 2, 0, 0], color: grad("#4fd8a4", "#1f8f6a") }, label: { show: true, position: "top", color: "#7fd8b6", fontSize: 9.5 }, data: labels.map(l => get(S.pPor, l)) }
            ]
        });
    }

    function chartPass() {
        const c = mk("c_pass"); if (!c) return;
        const rows = S.ov;
        c.setOption({
            tooltip: Object.assign({ trigger: "axis", axisPointer: { type: "shadow" } }, tip),
            grid: { left: 60, right: 40, top: 20, bottom: 22 },
            xAxis: axis({ type: "value", max: 100, axisLabel: { color: C.txt2, fontSize: 10, formatter: "{value}%" } }),
            yAxis: axis({ type: "category", data: rows.map(r => r.course === "math" ? "数学课" : "葡语课"), splitLine: { show: false } }),
            series: [{
                type: "bar", barWidth: 18,
                itemStyle: {
                    borderRadius: [0, 3, 3, 0],
                    color: (p) => p.dataIndex === 0 ? grad("#63aae8", "#2f6fb5") : grad("#4fd8a4", "#1f8f6a")
                },
                label: { show: true, position: "right", color: "#b7d4e6", fontSize: 10, formatter: (p) => p.value.toFixed(1) + "%" },
                data: rows.map(r => +(r.passRate * 100).toFixed(1))
            }]
        });
    }

    function chartRose() {
        const c = mk("c_rose"); if (!c) return;
        const color = { A: "#35c48e", B: "#4a8fd6", C: "#2fb0a6", D: "#e08a3c", F: "#d9534f", W: "#7d8a99" };
        const rows = S.grades.filter(r => r.course === "math");
        c.setOption({
            tooltip: Object.assign({ trigger: "item", formatter: "{b} 级：{c} 人（{d}%）" }, tip),
            legend: { orient: "vertical", right: 6, top: "center", itemWidth: 8, itemHeight: 8, itemGap: 8, textStyle: { color: C.txt2, fontSize: 10 } },
            series: [{
                type: "pie", roseType: "radius",
                radius: ["22%", "72%"], center: ["40%", "50%"],
                itemStyle: { borderColor: "#0b1728", borderWidth: 2, borderRadius: 2 },
                label: { color: C.txt2, fontSize: 9.5, formatter: "{b}" },
                labelLine: { length: 6, length2: 8, lineStyle: { color: C.line } },
                data: rows.map(r => ({ name: r.label, value: r.cnt, itemStyle: { color: color[r.label] || C.gray } }))
            }]
        });
    }

    /* ------------------------------ 图 4 ------------------------------ */
    function chartCorr() {
        const c = mk("c_corr"); if (!c) return;
        const rows = [...S.corr].sort((a, b) => a.r - b.r);
        c.setOption({
            tooltip: Object.assign({ trigger: "axis", axisPointer: { type: "shadow" }, formatter: (p) => `${p[0].name}<br/>r = <b>${p[0].value}</b>` }, tip),
            grid: { left: 108, right: 44, top: 14, bottom: 24 },
            xAxis: axis({ type: "value", min: -0.5, max: 1, axisLabel: { color: C.txt2, fontSize: 9.5 } }),
            yAxis: axis({ type: "category", data: rows.map(r => r.label), splitLine: { show: false }, axisLabel: { color: C.txt2, fontSize: 10 } }),
            series: [{
                type: "bar", barWidth: 11,
                itemStyle: {
                    borderRadius: 2,
                    color: (p) => p.value >= 0.3 ? "#35c48e" : (p.value > 0 ? "#2fb0a6" : (p.value < -0.3 ? "#d9534f" : "#e08a3c"))
                },
                label: { show: true, position: "right", color: "#a9c9e0", fontSize: 9.5 },
                markLine: {
                    silent: true, symbol: "none",
                    lineStyle: { color: "rgba(160,190,215,0.35)", type: "dashed" },
                    data: [{ xAxis: 0.3 }, { xAxis: 0 }, { xAxis: -0.3 }]
                },
                data: rows.map(r => r.r)
            }]
        });
    }

    function chartFail() {
        const c = mk("c_fail"); if (!c) return;
        const rows = S.gFail.filter(r => r.course === "math").sort((a, b) => a.label - b.label);
        c.setOption({
            tooltip: Object.assign({ trigger: "axis" }, tip),
            legend: { data: ["平均分", "及格率"], right: 8, top: 2, itemWidth: 8, itemHeight: 8, textStyle: { color: C.txt2, fontSize: 10 } },
            grid: { left: 44, right: 46, top: 30, bottom: 26 },
            xAxis: axis({ type: "category", data: rows.map(r => r.label + " 次") }),
            yAxis: [
                axis({ type: "value", max: 20, name: "平均分", nameTextStyle: { color: C.txt2, fontSize: 10 } }),
                axis({ type: "value", max: 100, splitLine: { show: false }, axisLabel: { color: C.txt2, fontSize: 10, formatter: "{value}%" } })
            ],
            series: [
                { name: "平均分", type: "bar", barWidth: 26, itemStyle: { borderRadius: [2, 2, 0, 0], color: grad("#f0a860", "#a8531f") }, label: { show: true, position: "top", color: "#f2be8a", fontSize: 9.5 }, data: rows.map(r => r.avgG3) },
                { name: "及格率", type: "line", yAxisIndex: 1, smooth: true, symbolSize: 6, lineStyle: { width: 2, color: C.teal2 }, itemStyle: { color: C.teal2 }, data: rows.map(r => +(r.passRate * 100).toFixed(1)) }
            ]
        });
    }

    function chartEdu() {
        const c = mk("c_edu"); if (!c) return;
        const medu = S.gMedu.filter(r => r.course === "math").sort((a, b) => a.label - b.label);
        const fedu = S.gFedu.filter(r => r.course === "math").sort((a, b) => a.label - b.label);
        const xs = medu.map(r => r.label + " 级");
        c.setOption({
            tooltip: Object.assign({ trigger: "axis" }, tip),
            legend: { data: ["母亲学历", "父亲学历"], right: 8, top: 2, itemWidth: 8, itemHeight: 8, textStyle: { color: C.txt2, fontSize: 10 } },
            grid: { left: 44, right: 18, top: 30, bottom: 26 },
            xAxis: axis({ type: "category", data: xs }),
            yAxis: axis({ type: "value", min: 8, max: 15, name: "平均分", nameTextStyle: { color: C.txt2, fontSize: 10 } }),
            series: [
                { name: "母亲学历", type: "line", smooth: true, symbolSize: 6, lineStyle: { width: 2, color: C.purple }, itemStyle: { color: C.purple }, areaStyle: { color: "rgba(139,124,216,0.12)" }, data: medu.map(r => r.avgG3) },
                { name: "父亲学历", type: "line", smooth: true, symbolSize: 6, lineStyle: { width: 2, color: C.teal2 }, itemStyle: { color: C.teal2 }, data: fedu.map(r => r.avgG3) }
            ]
        });
    }

    function chartDims() {
        const c = mk("c_dims"); if (!c) return;
        const only = (arr, course) => arr.filter(r => r.course === course);
        const nameOf = (by, label) => {
            const maps = {
                sex: { F: "女生", M: "男生" },
                address: { U: "城市", R: "农村" },
                famsize: { LE3: "≤3 人", GT3: ">3 人" },
                higher: { 0: "不想升学", 1: "想升学" }
            };
            return (maps[by] && maps[by][label]) || label;
        };
        const groups = [
            { by: "sex", data: only(S.gSex, "math") },
            { by: "address", data: only(S.gAddr, "math") },
            { by: "famsize", data: only(S.gFam, "math") },
            { by: "higher", data: only(S.gHigh, "math") }
        ];
        const xs = [], vals = [];
        groups.forEach(g => {
            g.data.sort((a, b) => String(a.label).localeCompare(String(b.label)));
            g.data.forEach(r => {
                xs.push(nameOf(g.by, r.label));
                vals.push({ value: r.avgG3, rate: +(r.passRate * 100).toFixed(1) });
            });
        });
        c.setOption({
            tooltip: Object.assign({
                trigger: "axis", axisPointer: { type: "shadow" },
                formatter: (p) => `${p[0].name}<br/>平均分 <b>${p[0].value}</b><br/>及格率 ${p[0].data.rate}%`
            }, tip),
            grid: { left: 40, right: 18, top: 22, bottom: 44 },
            xAxis: axis({ type: "category", data: xs, axisLabel: { color: C.txt2, fontSize: 9.5, interval: 0, rotate: 0 } }),
            yAxis: axis({ type: "value", min: 8, max: 13, name: "平均分", nameTextStyle: { color: C.txt2, fontSize: 10 } }),
            series: [{
                type: "bar", barWidth: 20,
                itemStyle: {
                    borderRadius: [2, 2, 0, 0],
                    color: (p) => ["#4a8fd6", "#2fb0a6", "#8b7cd8", "#35c48e"][Math.floor(p.dataIndex / 2)] || C.teal
                },
                label: { show: true, position: "top", color: "#a9c9e0", fontSize: 9.5 },
                data: vals
            }]
        });
    }

    /* ------------------------------ 图 5 ------------------------------ */
    function chartBubble() {
        const c = mk("c_bubble"); if (!c) return;
        const build = (course) => S.all.filter(r => r.course === course)
            .map(r => [r.absences, r.g3, r.studytime]);
        c.setOption({
            tooltip: Object.assign({
                formatter: (p) => `缺勤 ${p.value[0]} 次<br/>期末 ${p.value[1]} 分<br/>学习时长 ${p.value[2]} 档`
            }, tip),
            legend: { data: ["数学课", "葡语课"], right: 8, top: 2, itemWidth: 8, itemHeight: 8, textStyle: { color: C.txt2, fontSize: 10 } },
            grid: { left: 44, right: 18, top: 30, bottom: 34 },
            xAxis: axis({ type: "value", name: "缺勤次数", nameTextStyle: { color: C.txt2, fontSize: 10 }, nameGap: 22 }),
            yAxis: axis({ type: "value", max: 20, name: "期末成绩", nameTextStyle: { color: C.txt2, fontSize: 10 } }),
            series: [
                {
                    name: "数学课", type: "scatter", data: build("math"),
                    symbolSize: (v) => 3 + v[2] * 2.2,
                    itemStyle: { color: "rgba(99,170,232,0.55)", borderColor: "rgba(99,170,232,0.9)", borderWidth: 0.5 }
                },
                {
                    name: "葡语课", type: "scatter", data: build("por"),
                    symbolSize: (v) => 3 + v[2] * 2.2,
                    itemStyle: { color: "rgba(79,216,164,0.45)", borderColor: "rgba(79,216,164,0.9)", borderWidth: 0.5 }
                }
            ]
        });
    }

    function chartScatter() {
        const c = mk("c_scatter"); if (!c) return;
        const build = (course) => S.all.filter(r => r.course === course).map(r => [r.g2, r.g3]);
        c.setOption({
            tooltip: Object.assign({ formatter: (p) => `G2 ${p.value[0]} → G3 ${p.value[1]}` }, tip),
            legend: { data: ["数学课", "葡语课"], right: 8, top: 2, itemWidth: 8, itemHeight: 8, textStyle: { color: C.txt2, fontSize: 10 } },
            grid: { left: 44, right: 18, top: 30, bottom: 34 },
            xAxis: axis({ type: "value", min: 0, max: 20, name: "G2 第二次平时", nameTextStyle: { color: C.txt2, fontSize: 10 }, nameGap: 22 }),
            yAxis: axis({ type: "value", min: 0, max: 20, name: "G3 期末", nameTextStyle: { color: C.txt2, fontSize: 10 } }),
            series: [
                { name: "数学课", type: "scatter", symbolSize: 5, itemStyle: { color: "rgba(99,170,232,0.55)" }, data: build("math") },
                { name: "葡语课", type: "scatter", symbolSize: 5, itemStyle: { color: "rgba(79,216,164,0.45)" }, data: build("por") }
            ]
        });
    }

    /* ------------------------------ 图 6 明细表 ------------------------------ */
    let tableRows = [];

    function renderTable() {
        const kw = (document.getElementById("q").value || "").trim().toLowerCase();
        const course = document.getElementById("selCourse").value;
        const grade = document.getElementById("selGrade").value;

        tableRows = S.all.filter(r => {
            if (course && r.course !== course) return false;
            if (grade && r.grade !== grade) return false;
            if (kw) {
                const hay = [r.school, r.address, r.course, r.sex, r.grade].join(" ").toLowerCase();
                if (hay.indexOf(kw) < 0) return false;
            }
            return true;
        });

        const max = 400;
        const html = tableRows.slice(0, max).map(r => `<tr>
            <td>${r.id}</td>
            <td>${r.course === "math" ? "数学" : "葡语"}</td>
            <td>${r.school}</td>
            <td>${r.sex}</td>
            <td>${r.age}</td>
            <td>${r.address === "U" ? "城市" : "农村"}</td>
            <td>${r.studytime}</td>
            <td>${r.failures}</td>
            <td>${r.absences}</td>
            <td>${r.g1}</td>
            <td>${r.g2}</td>
            <td>${r.g3}</td>
            <td><span class="pill g${r.grade}">${r.grade}</span></td>
        </tr>`).join("");
        document.getElementById("tbody").innerHTML = html;
        document.getElementById("tblCount").textContent =
            `共 ${tableRows.length} 条${tableRows.length > max ? "，显示前 " + max + " 条" : ""}`;
    }

    /* ------------------------------ 页面调度 ------------------------------ */
    const RENDER = {
        0: () => { renderKpi(); chartStudyAvg(); chartSeg5(); },
        1: () => { chartStudyCnt(); chartStudyRate(); chartAbsent(); chartHeat("c_heat", S.heat); },
        2: () => { chartGrade(); chartSeg4(); chartPass(); chartRose(); },
        3: () => { chartCorr(); chartFail(); chartEdu(); chartDims(); },
        4: () => { chartBubble(); chartScatter(); chartHeat("c_heat2", S.heat); },
        5: () => { renderTable(); }
    };

    function go(idx) {
        if (idx < 0 || idx > 5) return;
        current = idx;
        document.querySelectorAll(".page").forEach((p, i) => p.classList.toggle("active", i === idx));
        document.querySelectorAll(".nav-item").forEach((n, i) => n.classList.toggle("active", i === idx));
        document.getElementById("pageTag").textContent =
            String(idx + 1).padStart(2, "0") + " / 06　" + PAGE_NAME[idx];
        document.querySelectorAll(".footbar .dots").forEach(g => {
            const n = +g.id.replace("dots", "") - 1;
            g.innerHTML = [0, 1, 2, 3, 4, 5]
                .map(i => `<i class="${i === n ? "on" : ""}"></i>`).join("");
        });
        if (!rendered[idx]) {
            rendered[idx] = true;
            setTimeout(() => {
                RENDER[idx]();
                Object.values(charts).forEach(c => c.resize());
            }, 30);
        } else {
            setTimeout(() => Object.values(charts).forEach(c => c.resize()), 30);
        }
    }

    function bind() {
        document.getElementById("nav").addEventListener("click", e => {
            const item = e.target.closest(".nav-item");
            if (item) go(+item.dataset.page);
        });
        document.addEventListener("keydown", e => {
            if (e.key === "ArrowRight") go(current + 1);
            if (e.key === "ArrowLeft") go(current - 1);
            if (/^[1-6]$/.test(e.key)) go(+e.key - 1);
        });
        document.getElementById("btnRefresh").addEventListener("click", () => refresh(true));
        document.getElementById("btnFull").addEventListener("click", () => {
            if (document.fullscreenElement) document.exitFullscreen();
            else document.documentElement.requestFullscreen();
        });
        document.getElementById("btnQuery").addEventListener("click", renderTable);
        document.getElementById("q").addEventListener("keydown", e => { if (e.key === "Enter") renderTable(); });
        document.getElementById("selCourse").addEventListener("change", renderTable);
        document.getElementById("selGrade").addEventListener("change", renderTable);
        document.getElementById("btnExport").addEventListener("click", () => {
            const head = "ID,科目,学校,性别,年龄,住址,学习时长档,不及格次数,缺勤,G1,G2,G3,等级\n";
            const body = tableRows.map(r => [r.id, r.course, r.school, r.sex, r.age, r.address,
                r.studytime, r.failures, r.absences, r.g1, r.g2, r.g3, r.grade].join(",")).join("\n");
            const blob = new Blob(["\ufeff" + head + body], { type: "text/csv;charset=utf-8" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "学生成绩明细.csv";
            a.click();
            toast("已导出 " + tableRows.length + " 条记录");
        });
        window.addEventListener("resize", () => Object.values(charts).forEach(c => c.resize()));
    }

    function clock() {
        const tick = () => {
            const d = new Date();
            document.getElementById("clock").textContent = d.toLocaleTimeString("zh-CN", { hour12: false });
            document.getElementById("today").textContent =
                d.getMonth() + 1 + "月" + d.getDate() + "日 周" + "日一二三四五六"[d.getDay()];
        };
        tick();
        setInterval(tick, 1000);
    }

    async function refresh(manual) {
        try {
            await loadData();
            rendered[0] = false;
            for (let i = 0; i < 6; i++) {
                if (rendered[i]) { rendered[i] = false; }
            }
            go(0);
            if (manual) toast("数据已刷新");
        } catch (err) {
            console.error(err);
            toast("加载失败：" + err.message);
        }
    }

    /* ------------------------------ 启动 ------------------------------ */
    async function main() {
        clock();
        bind();
        try {
            await loadData();
            document.getElementById("upd").textContent = new Date().toLocaleTimeString("zh-CN", { hour12: false });
            const qp = +new URLSearchParams(location.search).get("p");
            go(qp >= 1 && qp <= 6 ? qp - 1 : 0);
        } catch (err) {
            console.error(err);
            toast("后端未就绪：" + err.message + "，3 秒后重试");
            let n = 0;
            const timer = setInterval(async () => {
                n++;
                try {
                    await loadData();
                    clearInterval(timer);
                    go(0);
                    toast("数据已加载");
                } catch (e2) {
                    if (n >= 10) clearInterval(timer);
                }
            }, 3000);
        }
    }

    main();
})();
