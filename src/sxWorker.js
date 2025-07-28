// This is the Web Worker file (sxWorker.js)
// It runs the heavy calculations in the background

self.onmessage = (event) => {
    const inputs = event.data;

    try {
        const solve = (objectiveFunc, initialGuess, tolerance = 1e-7, maxIterations = 100) => {
            let x0 = initialGuess - 0.1;
            let x1 = initialGuess + 0.1;
            if (x0 <= 0) x0 = 0.1;

            let f0 = objectiveFunc(x0);
            let f1 = objectiveFunc(x1);

            for (let i = 0; i < maxIterations; i++) {
                if (Math.abs(f1) < tolerance) return x1;
                let x2 = x1 - f1 * (x1 - x0) / (f1 - f0);
                if (isNaN(x2) || !isFinite(x2) || x2 <= 0) {
                   throw new Error("محاسبات واگرا شد یا به یک نتیجه نامعتبر رسید. لطفاً ورودی‌ها را بررسی کنید.");
                }
                x0 = x1;
                f0 = f1;
                x1 = x2;
                f1 = objectiveFunc(x1);
            }
            throw new Error(`بهینه‌سازی پس از ${maxIterations} تکرار به همگرایی نرسید.`);
        };

        const objectiveFunction = (V_percent_guess) => {
            const res = calculateAll(inputs, V_percent_guess, solve);
            if (!res) return 1e9;
            return res.constraints.so_consistency;
        };

        const optimalVPercent = solve(objectiveFunction, 17.1);
        if (optimalVPercent <= 0 || optimalVPercent > 50) {
             throw new Error("درصد بهینه استخراج‌کننده خارج از محدوده قابل قبول است (0-50%). ورودی‌ها را بررسی کنید.");
        }
        
        const finalResults = calculateAll(inputs, optimalVPercent, solve);
        
        postMessage({ results: finalResults });

    } catch (e) {
        postMessage({ error: e.message });
    }
};


const calculateAll = (i, V_percent, solve) => {
    try {
        const solveCubic = (a, b, c, d) => {
            if (Math.abs(a) < 1e-9) return;
            const p = c / a - (b * b) / (3 * a * a);
            const q = (2 * b * b * b) / (27 * a * a * a) - (b * c) / (3 * a * a) + d / a;
            const term1 = q / 2;
            const term2 = (q * q) / 4 + (p * p * p) / 27;
            if (term2 >= 0) {
                const sqrt_term2 = Math.sqrt(term2);
                const u = Math.cbrt(-term1 + sqrt_term2);
                const v = Math.cbrt(-term1 - sqrt_term2);
                return u + v - b / (3 * a);
            } else {
                const r = Math.sqrt(-(p*p*p)/27);
                const phi = Math.acos(-q / (2 * r));
                return 2 * Math.cbrt(r) * Math.cos(phi/3) - b/(3*a);
            }
        };
        
        const extraction = (() => {
            const constants = { a_ex: i.plsAcid + 1.54 * i.plsCu, b_ex: -1.54, c_ex: 3.303 * V_percent, d_ex: -3.0842, e_ex: -25.698 * Math.pow(V_percent, -1.704), f_ex: 10.663 * Math.pow(V_percent, -0.608) };
            const getCu_or_from_Cu_aq = (Cu_aq) => {
                if (Cu_aq <= 0) return 0;
                const g_ex = Math.pow(constants.a_ex + constants.b_ex * Cu_aq, 2) / Cu_aq;
                const alpha_ex = (2 * constants.c_ex * constants.d_ex * constants.e_ex + Math.pow(constants.d_ex, 2) * constants.f_ex) / (Math.pow(constants.d_ex, 2) * constants.e_ex);
                const lambda_ex = (2 * constants.c_ex * constants.d_ex * constants.f_ex + Math.pow(constants.c_ex, 2) * constants.e_ex - g_ex) / (Math.pow(constants.d_ex, 2) * constants.e_ex);
                const epsilon_ex = (constants.f_ex * Math.pow(constants.c_ex, 2)) / (Math.pow(constants.d_ex, 2) * constants.e_ex);
                return solveCubic(1, alpha_ex, lambda_ex, epsilon_ex);
            };
            const getCu_aq_from_Cu_or = (Cu_or) => {
                if (Cu_or <= 0) return 0;
                const h_ex = ((constants.e_ex * Cu_or + constants.f_ex) * Math.pow(constants.c_ex + constants.d_ex * Cu_or, 2)) / Cu_or;
                const a = Math.pow(constants.b_ex, 2);
                const b = 2 * constants.a_ex * constants.b_ex - h_ex;
                const c = Math.pow(constants.a_ex, 2);
                const discriminant = b*b - 4*a*c;
                if (discriminant < 0) return null;
                return (h_ex - 2*constants.a_ex*constants.b_ex - Math.sqrt(discriminant)) / (2*a);
            };
            const ml = getCu_or_from_Cu_aq(i.plsCu);
            const lo = ml * (i.percentageML / 100);
            const Y_out_E1 = lo;
            const X_in_E1 = i.plsCu;
            const stage1_solver_func = (X_out_guess) => {
                const Y_eq = getCu_or_from_Cu_aq(X_out_guess);
                const Y_in = Y_out_E1 - (X_in_E1 - X_out_guess) / i.o_a_ex;
                return (Y_out_E1 - Y_in) - (i.effE1 / 100) * (Y_eq - Y_in);
            };
            const X_out_E1 = solve(stage1_solver_func, X_in_E1 * 0.3, 1e-7, 100);
            const Y_in_E1 = Y_out_E1 - (X_in_E1 - X_out_E1) / i.o_a_ex;
            const Y_out_E2 = Y_in_E1;
            const X_in_E2 = X_out_E1;
            const stage2_solver_func = (X_out_guess) => {
                const Y_eq = getCu_or_from_Cu_aq(X_out_guess);
                const Y_in = Y_out_E2 - (X_in_E2 - X_out_guess) / i.o_a_ex;
                return (Y_out_E2 - Y_in) - (i.effE2 / 100) * (Y_eq - Y_in);
            };
            const X_out_E2 = solve(stage2_solver_func, X_in_E2 * 0.15, 1e-7, 100);
            const Y_in_E2 = Y_out_E2 - (X_in_E2 - X_out_E2) / i.o_a_ex;
            const so = Y_in_E2;
            const raff = X_out_E2;
            const recovery = (i.plsCu - raff) / i.plsCu * 100;
            const raffAcid = i.plsAcid + (i.plsCu - raff) * 1.54;
            const amlp = 0.415 * Math.pow(V_percent, 1.096);
            const equilibriumCurve = Array.from({ length: 101 }, (_, k) => ({ x: (i.plsCu / 100) * k, y: getCu_or_from_Cu_aq((i.plsCu / 100) * k) })).filter(p => p.y >= 0);
            const operatingLine = [{ name: 'SO', x: raff, y: so }, { name: 'LO', x: i.plsCu, y: lo }];
            const stages = [{ name: 'E1', x: X_out_E1, y: Y_out_E1 }, { name: 'E2', x: X_out_E2, y: Y_out_E2 }];
            const details = { raffAcid, amlp, constants, stage1: { A: { x: X_in_E1, y: Y_out_E1 }, B: { x: X_out_E1, y: Y_out_E1 }, C: { x: X_out_E1, y: Y_in_E1 }, D: { x: getCu_aq_from_Cu_or(getCu_or_from_Cu_aq(X_out_E1)), y: getCu_or_from_Cu_aq(X_out_E1) }, efficiency: i.effE1 }, stage2: { A: { x: X_in_E2, y: Y_out_E2 }, B: { x: X_out_E2, y: Y_out_E2 }, C: { x: X_out_E2, y: Y_in_E2 }, D: { x: getCu_aq_from_Cu_or(getCu_or_from_Cu_aq(X_out_E2)), y: getCu_or_from_Cu_aq(X_out_E2) }, efficiency: i.effE2 } };
            return { ml, lo, so, raff, recovery, mccabeThiele: { equilibriumCurve, operatingLine, stages }, details };
        })();
        
        const stripping = (() => {
            const { lo, so: so_ex } = extraction;
            if (lo <= so_ex) throw new Error("خطای محاسباتی: غلظت LO باید بیشتر از SO باشد.");
            const o_a_st = (i.adCu - i.spCu) / (lo - so_ex);
            const constants = { a_st: i.spAcid + 1.54 * i.spCu, b_st: -1.54, c_st: 3.303 * V_percent, d_st: -3.0842, e_st: (5.11e-3 * V_percent) - 0.194, f_st: 12.81 * Math.pow(V_percent, -0.901) };
            const getCu_or_from_Cu_aq_stripping = (Cu_aq) => {
                if (Cu_aq <= 0) return 0;
                const g_st = Math.pow(constants.a_st + constants.b_st * Cu_aq, 2) / Cu_aq;
                const alpha_st = (2 * constants.c_st * constants.d_st * constants.e_st + Math.pow(constants.d_st, 2) * constants.f_st) / (Math.pow(constants.d_st, 2) * constants.e_st);
                const lambda_st = (2 * constants.c_st * constants.d_st * constants.f_st + Math.pow(constants.c_st, 2) * constants.e_st - g_st) / (Math.pow(constants.d_st, 2) * constants.e_st);
                const epsilon_st = (constants.f_st * Math.pow(constants.c_st, 2)) / (Math.pow(constants.d_st, 2) * constants.e_st);
                return solveCubic(1, alpha_st, lambda_st, epsilon_st);
            };
            const Y_in_S1 = lo;
            const X_out_S1 = i.adCu;
            const Y_eq_S1 = getCu_or_from_Cu_aq_stripping(X_out_S1);
            const Y_out_S1 = Y_in_S1 - (i.effS1/100)*(Y_in_S1 - Y_eq_S1);
            const X_in_S1 = X_out_S1 - o_a_st * (Y_in_S1 - Y_out_S1);
            const Y_in_S2 = Y_out_S1;
            const X_out_S2 = X_in_S1;
            const Y_eq_S2 = getCu_or_from_Cu_aq_stripping(X_out_S2);
            const so = Y_in_S2 - (i.effS2/100)*(Y_in_S2 - Y_eq_S2);
            const recovery = (lo - so) / lo * 100;
            const netCu = (lo - so) / V_percent;
            const spFlow = (inputs.plsFlow * inputs.o_a_ex) / o_a_st;
            const equilibriumCurve = Array.from({ length: 101 }, (_, k) => ({ x: i.spCu + ((i.adCu - i.spCu + 5) / 100) * k, y: getCu_or_from_Cu_aq_stripping(i.spCu + ((i.adCu - i.spCu + 5) / 100) * k) })).filter(p => p.y >= 0);
            const operatingLine = [{ name: 'SO', x: i.spCu, y: so }, { name: 'LO', x: i.adCu, y: lo }];
            const stages = [{ name: 'S1', x: X_out_S1, y: Y_in_S1 }, { name: 'S2', x: X_out_S2, y: Y_in_S2 }];
            const details = { o_a_st, spFlow, constants, stage1: { A: { x: X_out_S1, y: Y_in_S1 }, B: { x: X_out_S1, y: Y_out_S1 }, C: { x: X_in_S1, y: Y_out_S1 }, D: { x: X_out_S1, y: Y_eq_S1 }, efficiency: i.effS1 }, stage2: { A: { x: X_out_S2, y: Y_in_S2 }, B: { x: X_out_S2, y: so }, C: { x: i.spCu, y: so }, D: { x: X_out_S2, y: Y_eq_S2 }, efficiency: i.effS2 } };
            return { so, recovery, netCu, mccabeThiele: { equilibriumCurve, operatingLine, stages }, details };
        })();

        return { v_percent: V_percent, extraction, stripping, constraints: { so_consistency: extraction.so - stripping.so } };
    } catch (e) {
        console.error("Calculation failed:", e);
        return null;
    }
};
