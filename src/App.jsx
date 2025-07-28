import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Scatter, Label, AreaChart, Area } from 'recharts';
import { utils, writeFile } from 'xlsx';
import { ArrowDownToLine, Settings, FileDown, RefreshCw, HelpCircle, X, Sun, Moon, Save, Upload, Info } from 'lucide-react';

// Main App Component
const App = () => {
    const initialInputs = {
        plsFlow: 400,
        plsCu: 7.0,
        plsAcid: 1.96,
        percentageML: 80,
        o_a_ex: 1.25,
        effE1: 95,
        effE2: 95,
        spCu: 35,
        spAcid: 190,
        adCu: 50,
        effS1: 98,
        effS2: 98,
    };

    const [inputs, setInputs] = useState(() => {
        const savedInputs = localStorage.getItem('sx-inputs-advanced');
        return savedInputs ? JSON.parse(savedInputs) : initialInputs;
    });
    const [results, setResults] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isHelpVisible, setIsHelpVisible] = useState(false);
    const [initialRun, setInitialRun] = useState(false);
    const [darkMode, setDarkMode] = useState(true);
    const [activeTab, setActiveTab] = useState('results');

    useEffect(() => {
        localStorage.setItem('sx-inputs-advanced', JSON.stringify(inputs));
    }, [inputs]);

    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [darkMode]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setInputs(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    };

    const resetInputs = () => {
        setInputs(initialInputs);
    };

    const saveConfig = () => {
        const dataStr = JSON.stringify(inputs);
        const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
        
        const link = document.createElement('a');
        link.setAttribute('href', dataUri);
        link.setAttribute('download', 'copper-sx-config.json');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const loadConfig = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const config = JSON.parse(event.target.result);
                if (typeof config.plsFlow === 'number') {
                    setInputs(config);
                } else {
                    throw new Error("Invalid config format");
                }
            } catch (err) {
                setError('فایل پیکربندی نامعتبر است');
                setTimeout(() => setError(null), 5000);
            }
        };
        reader.readAsText(file);
        e.target.value = null;
    };

    const runSolver = useCallback(() => {
        setIsLoading(true);
        setError(null);
        setResults(null);
        setInitialRun(true);
        
        const validationError = validateInputs(inputs);
        if (validationError) {
            setError(validationError);
            setIsLoading(false);
            return;
        }

        const worker = new Worker(new URL('./sxWorker.js', import.meta.url));
        
        worker.postMessage(inputs);
        
        worker.onmessage = (event) => {
            const { data } = event;
            if (data.error) {
                setError(data.error);
            } else {
                setResults(data.results);
            }
            setIsLoading(false);
            worker.terminate();
        };
        
        worker.onerror = (error) => {
            setError(`خطای محاسباتی: ${error.message}`);
            setIsLoading(false);
            worker.terminate();
        };
    }, [inputs]);

    const validateInputs = (inputs) => {
        const errors = [];
        if (inputs.plsFlow <= 0) errors.push('جریان PLS باید بزرگتر از صفر باشد');
        if (inputs.plsCu <= 0) errors.push('مس در PLS باید بزرگتر از صفر باشد');
        if (inputs.percentageML <= 0 || inputs.percentageML > 100) errors.push('درصد بارگذاری ماکزیمم باید بین 0 تا 100 باشد');
        if (inputs.o_a_ex <= 0) errors.push('نسبت O/A باید بزرگتر از صفر باشد');
        if (inputs.adCu <= inputs.spCu) errors.push('مس در الکترولیت پیشرفته باید بیشتر از الکترولیت مصرفی باشد');
        return errors.length > 0 ? errors.join('. ') : null;
    };

    const exportToExcel = () => {
        if (!results) {
            alert("ابتدا باید محاسبات انجام شود.");
            return;
        }
        
        const wb = utils.book_new();
        const res = results;

        const setColumnWidths = (ws, widths) => {
            ws['!cols'] = widths.map(w => ({ wch: w }));
        };

        const guideData = [
            ["راهنمای فایل اکسل خروجی"], [],
            ["این فایل شامل نتایج کامل شبیه‌سازی و بهینه‌سازی مدار استخراج حلالی است."], [],
            ["شیت‌ها:"],
            ["۱. خلاصه نتایج:", "مهم‌ترین پارامترهای عملکردی مدار را به صورت کلی نمایش می‌دهد."],
            ["۲. جزئیات استخراج:", "شامل تمام داده‌های محاسباتی برای هر مرحله در بخش استخراج است."],
            ["۳. جزئیات استریپینگ:", "شامل تمام داده‌های محاسباتی برای هر مرحله در بخش استریپینگ است."],
            ["۴. داده نمودارها:", "شامل داده‌های خام برای ساخت نمودارهای McCabe-Thiele در نرم‌افزار اکسل است."], [],
            ["چگونه نمودار McCabe-Thiele را در اکسل بسازیم؟"],
            ["۱. به شیت 'داده نمودار استخراج' یا 'داده نمودار استریپینگ' بروید."],
            ["۲. تمام داده‌های مربوط به یک نمودار (شامل ستون‌های 'نوع خط'، 'Cu آبی' و 'Cu آلی') را انتخاب کنید."],
            ["۳. از منوی Insert در اکسل، به بخش Charts بروید."],
            ["۴. نمودار 'Scatter with Smooth Lines' را انتخاب کنید."],
        ];
        const wsGuide = utils.aoa_to_sheet(guideData);
        setColumnWidths(wsGuide, [25, 80]);
        utils.book_append_sheet(wb, wsGuide, 'راهنما');

        const summaryData = [
            ["پارامتر کلیدی", "مقدار", "واحد"],
            ["درصد بهینه استخراج‌کننده", res.v_percent.toFixed(2), "%"],
            ["انتقال خالص مس", res.stripping.netCu.toFixed(3), "(g/L)/V%"],
            ["بازیابی استخراج", res.extraction.recovery.toFixed(2), "%"],
            ["بازیابی استریپینگ", res.stripping.recovery.toFixed(2), "%"],
            ["بارگذاری ماکزیمم (ML)", res.extraction.ml.toFixed(3), "g/L"],
            ["بارگذاری شده (LO)", res.extraction.lo.toFixed(3), "g/L"],
            ["رافینت (Raff)", res.extraction.raff.toFixed(3), "g/L"],
            ["اسید در رافینت", res.extraction.details.raffAcid.toFixed(3), "g/L"],
            ["O/A استریپینگ", res.stripping.details.o_a_st.toFixed(3), ""],
        ];
        const wsSummary = utils.aoa_to_sheet(summaryData);
        setColumnWidths(wsSummary, [30, 15, 15]);
        utils.book_append_sheet(wb, wsSummary, 'خلاصه نتایج');

        const exDetails = [
            ["جزئیات مرحله استخراج"], [],
            ["پارامترهای عمومی"], ["پارامتر", "مقدار"],
            ["جریان آلی (m³/h)", (inputs.plsFlow * inputs.o_a_ex).toFixed(2)],
            ["AMLp (g/L)", res.extraction.details.amlp.toFixed(3)], [],
            ["ثابت‌های محاسباتی"], ["ثابت", "مقدار"],
            ...Object.entries(res.extraction.details.constants).map(([key, value]) => [key, value.toFixed(3)]), [],
            ["مرحله ۱ (E1)"], ["نقطه", "Cu آبی (g/L)", "Cu آلی (g/L)"],
            ...Object.entries(res.extraction.details.stage1).filter(([key]) => key !== 'efficiency').map(([key, value]) => [key.toUpperCase(), value.x.toFixed(3), value.y.toFixed(3)]),
            ["بازدهی مرحله ۱ (%)", res.extraction.details.stage1.efficiency.toFixed(2), ""], [],
            ["مرحله ۲ (E2)"], ["نقطه", "Cu آبی (g/L)", "Cu آلی (g/L)"],
            ...Object.entries(res.extraction.details.stage2).filter(([key]) => key !== 'efficiency').map(([key, value]) => [key.toUpperCase(), value.x.toFixed(3), value.y.toFixed(3)]),
            ["بازدهی مرحله ۲ (%)", res.extraction.details.stage2.efficiency.toFixed(2), ""],
        ];
        const wsEx = utils.aoa_to_sheet(exDetails);
        setColumnWidths(wsEx, [20, 15, 15]);
        utils.book_append_sheet(wb, wsEx, 'جزئیات استخراج');
        
        const stDetails = [
            ["جزئیات مرحله استریپینگ"], [],
            ["پارامترهای عمومی"], ["پارامتر", "مقدار"],
            ["جریان الکترولیت مصرفی (m³/h)", res.stripping.details.spFlow.toFixed(2)], [],
            ["ثابت‌های محاسباتی"], ["ثابت", "مقدار"],
            ...Object.entries(res.stripping.details.constants).map(([key, value]) => [key, value.toFixed(3)]), [],
            ["مرحله ۱ (S1)"], ["نقطه", "Cu آبی (g/L)", "Cu آلی (g/L)"],
            ...Object.entries(res.stripping.details.stage1).filter(([key]) => key !== 'efficiency').map(([key, value]) => [key.toUpperCase(), value.x.toFixed(3), value.y.toFixed(3)]),
            ["بازدهی مرحله ۱ (%)", res.stripping.details.stage1.efficiency.toFixed(2), ""], [],
            ["مرحله ۲ (S2)"], ["نقطه", "Cu آبی (g/L)", "Cu آلی (g/L)"],
            ...Object.entries(res.stripping.details.stage2).filter(([key]) => key !== 'efficiency').map(([key, value]) => [key.toUpperCase(), value.x.toFixed(3), value.y.toFixed(3)]),
            ["بازدهی مرحله ۲ (%)", res.stripping.details.stage2.efficiency.toFixed(2), ""],
        ];
        const wsSt = utils.aoa_to_sheet(stDetails);
        setColumnWidths(wsSt, [20, 15, 15]);
        utils.book_append_sheet(wb, wsSt, 'جزئیات استریپینگ');

        const chartHeader = ["داده‌های نمودار (برای ساخت نمودار در اکسل استفاده کنید)"];
        const exChartData = [ ...chartHeader, [], ["نمودار استخراج"], ["نوع خط", "Cu آبی (g/L)", "Cu آلی (g/L)"], ...res.extraction.mccabeThiele.equilibriumCurve.map(p => ["تعادل", p.x.toFixed(3), p.y.toFixed(3)]), [], ...res.extraction.mccabeThiele.operatingLine.map(p => ["عملیاتی", p.x.toFixed(3), p.y.toFixed(3)]) ];
        const stChartData = [ ...chartHeader, [], ["نمودار استریپینگ"], ["نوع خط", "Cu آبی (g/L)", "Cu آلی (g/L)"], ...res.stripping.mccabeThiele.equilibriumCurve.map(p => ["تعادل", p.x.toFixed(3), p.y.toFixed(3)]), [], ...res.stripping.mccabeThiele.operatingLine.map(p => ["عملیاتی", p.x.toFixed(3), p.y.toFixed(3)]) ];
        const wsChartEx = utils.aoa_to_sheet(exChartData);
        const wsChartSt = utils.aoa_to_sheet(stChartData);
        setColumnWidths(wsChartEx, [40, 15, 15]);
        setColumnWidths(wsChartSt, [40, 15, 15]);
        utils.book_append_sheet(wb, wsChartEx, 'داده نمودار استخراج');
        utils.book_append_sheet(wb, wsChartSt, 'داده نمودار استریپینگ');
        
        writeFile(wb, "Copper_SX_Optimization_Full_Details.xlsx");
    };
    
    return (
        <div className="bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 min-h-screen font-sans p-4 md:p-8 transition-colors duration-300">
            {isHelpVisible && <HelpModal onClose={() => setIsHelpVisible(false)} />}
            <div className="max-w-7xl mx-auto">
                <header className="flex flex-col md:flex-row justify-between items-center mb-8 pb-4 border-b border-gray-300 dark:border-gray-700">
                    <div>
                        <h1 className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">بهینه‌ساز فرآیند استخراج حلالی مس</h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">ابزار شبیه‌سازی و بهینه‌سازی بر اساس مدل نیمه‌تجربی</p>
                        <p className="text-gray-500 mt-2 text-sm">طراح: میلاد جهانی</p>
                    </div>
                    <div className="flex items-center space-x-2 mt-4 md:mt-0 flex-wrap justify-center">
                         <button onClick={() => setDarkMode(!darkMode)} className="flex items-center bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-2 px-4 rounded-lg transition-colors">
                            {darkMode ? <Sun size={18} className="ml-2" /> : <Moon size={18} className="ml-2" />}
                            {darkMode ? 'حالت روشن' : 'حالت تاریک'}
                        </button>
                         <button onClick={() => setIsHelpVisible(true)} className="flex items-center bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-2 px-4 rounded-lg transition-colors">
                            <HelpCircle size={18} className="ml-2" />
                            راهنمای برنامه
                        </button>
                        <button onClick={saveConfig} className="flex items-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                            <Save size={18} className="ml-2" />
                            ذخیره تنظیمات
                        </button>
                        <label className="flex items-center bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-colors cursor-pointer">
                            <Upload size={18} className="ml-2" />
                            بارگذاری تنظیمات
                            <input type="file" accept=".json" onChange={loadConfig} className="hidden" />
                        </label>
                         <button onClick={runSolver} className="flex items-center bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                            {isLoading ? <RefreshCw size={18} className="ml-2 animate-spin" /> : <Settings size={18} className="ml-2" />}
                            {isLoading ? 'در حال محاسبه...' : 'محاسبه'}
                        </button>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Input Panel */}
                    <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold text-cyan-600 dark:text-cyan-400 flex items-center">
                                <Settings size={20} className="ml-2"/> پارامترهای ورودی
                            </h2>
                            <button onClick={resetInputs} className="text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 px-3 py-1 rounded">
                                بازنشانی
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            {/* Extraction Inputs */}
                            <div>
                                <h3 className="font-bold text-gray-700 dark:text-gray-300 border-b border-gray-300 dark:border-gray-600 pb-1 mb-2">مرحله استخراج (Extraction)</h3>
                                <InputRow label="جریان PLS (m³/h)" name="plsFlow" value={inputs.plsFlow} onChange={handleInputChange} />
                                <InputRow label="مس در PLS (g/L)" name="plsCu" value={inputs.plsCu} onChange={handleInputChange} />
                                <InputRow label="اسید در PLS (g/L)" name="plsAcid" value={inputs.plsAcid} onChange={handleInputChange} />
                                <InputRow label="درصد بارگذاری ماکزیمم (%)" name="percentageML" value={inputs.percentageML} onChange={handleInputChange} />
                                <InputRow label="نسبت O/A" name="o_a_ex" value={inputs.o_a_ex} onChange={handleInputChange} />
                                <InputRow label="بازدهی مرحله E1 (%)" name="effE1" value={inputs.effE1} onChange={handleInputChange} />
                                <InputRow label="بازدهی مرحله E2 (%)" name="effE2" value={inputs.effE2} onChange={handleInputChange} />
                            </div>
                            
                            {/* Stripping Inputs */}
                            <div>
                                <h3 className="font-bold text-gray-700 dark:text-gray-300 border-b border-gray-300 dark:border-gray-600 pb-1 mb-2">مرحله استریپینگ (Stripping)</h3>
                                <InputRow label="مس در الکترولیت مصرفی (g/L)" name="spCu" value={inputs.spCu} onChange={handleInputChange} />
                                <InputRow label="اسید در الکترولیت مصرفی (g/L)" name="spAcid" value={inputs.spAcid} onChange={handleInputChange} />
                                <InputRow label="مس در الکترولیت پیشرفته (g/L)" name="adCu" value={inputs.adCu} onChange={handleInputChange} />
                                <InputRow label="بازدهی مرحله S1 (%)" name="effS1" value={inputs.effS1} onChange={handleInputChange} />
                                <InputRow label="بازدهی مرحله S2 (%)" name="effS2" value={inputs.effS2} onChange={handleInputChange} />
                            </div>
                        </div>
                    </div>

                    {/* Results and Charts */}
                    <div className="lg:col-span-2">
                         {error && (
                            <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 p-4 rounded-xl mb-6">
                                <div className="font-bold flex items-center"><X size={20} className="ml-2" /> خطا در محاسبات</div>
                                <div className="mt-2">{error}</div>
                            </div>
                         )}
                        
                         {!initialRun && !error && (
                            <div className="flex flex-col justify-center items-center h-96 bg-white dark:bg-gray-800 rounded-xl shadow text-center p-4">
                                <Settings size={48} className="text-cyan-500 mb-4" />
                                <h3 className="text-xl text-gray-700 dark:text-gray-300">آماده برای بهینه‌سازی</h3>
                                <p className="text-gray-600 dark:text-gray-400 mt-2">مقادیر ورودی را تنظیم کرده و روی دکمه "محاسبه" کلیک کنید.</p>
                            </div>
                         )}
                        
                         {isLoading && (
                            <div className="flex justify-center items-center h-96 bg-white dark:bg-gray-800 rounded-xl shadow">
                                <div className="text-center">
                                    <RefreshCw size={48} className="text-cyan-500 mb-4 mx-auto animate-spin" />
                                    <div className="text-cyan-600 dark:text-cyan-400 text-lg">در حال انجام محاسبات پیچیده...</div>
                                </div>
                            </div>
                         )}
                        
                         {results && !isLoading && !error && (
                            <div className="space-y-6">
                                <ResultsSummary results={results} />
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                                    <ChartCard title="نمودار McCabe-Thiele: استخراج" data={results.extraction.mccabeThiele} />
                                    <ChartCard title="نمودار McCabe-Thiele: استریپینگ" data={results.stripping.mccabeThiele} />
                                </div>
                            </div>
                         )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const HelpModal = ({ onClose }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 border border-gray-300 dark:border-gray-700">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">راهنمای برنامه</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                        <X size={24} />
                    </button>
                </div>
                <div className="space-y-4 text-gray-700 dark:text-gray-300 text-right">
                    <p>با سلام، من، <strong>میلاد جهانی</strong>، این برنامه را به عنوان یک ابزار مهندسی برای شبیه‌سازی و بهینه‌سازی مدارهای استخراج حلالی مس (SX) طراحی کرده‌ام. هسته محاسباتی آن بر اساس یک مدل معتبر نیمه‌تجربی برای استخراج‌کننده Lix984N پیاده‌سازی شده است.</p>
                    
                    <h3 className="text-lg font-semibold text-cyan-600 dark:text-cyan-500 pt-2 border-t border-gray-300 dark:border-gray-700">نحوه کار</h3>
                    <p>هدف اصلی من از طراحی این برنامه، ایجاد ابزاری بود که با دریافت پارامترهای ورودی مدار، مقدار بهینه <strong>درصد استخراج‌کننده (V%)</strong> را به گونه‌ای محاسبه کند که مدار به پایدارترین حالت خود برسد. این پایداری بر اساس شرط برابری غلظت مس در فاز آلی ورودی و خروجی مدار (`SO_extraction = SO_stripping`) تعریف شده است. سپس تمام پارامترهای عملکردی مدار بر اساس این مقدار بهینه محاسبه و نمایش داده می‌شود.</p>

                    <h3 className="text-lg font-semibold text-cyan-600 dark:text-cyan-500 pt-2 border-t border-gray-300 dark:border-gray-700">پارامترهای ورودی</h3>
                    <ul className="list-disc list-inside space-y-2 pr-4">
                        <li><strong className="text-gray-800 dark:text-gray-100">جریان PLS:</strong> دبی محلول باردار حامل مس ورودی به مدار.</li>
                        <li><strong className="text-gray-800 dark:text-gray-100">مس و اسید در PLS:</strong> غلظت مس و اسید سولفوریک در محلول ورودی.</li>
                        <li><strong className="text-gray-800 dark:text-gray-100">درصد بارگذاری ماکزیمم (%ML):</strong> درصدی از حداکثر ظرفیت بارگذاری فاز آلی که در عمل به آن می‌رسیم. این پارامتر برای کنترل میزان استخراج آهن اهمیت دارد.</li>
                        <li><strong className="text-gray-800 dark:text-gray-100">نسبت O/A:</strong> نسبت فاز آلی به آبی در مرحله استخراج.</li>
                        <li><strong className="text-gray-800 dark:text-gray-100">بازدهی مراحل (Eff):</strong> بازدهی هر مرحله میکسر-ستر در رسیدن به تعادل.</li>
                        <li><strong className="text-gray-800 dark:text-gray-100">مس و اسید در الکترولیت:</strong> غلظت‌های ورودی و خروجی مدار تانک‌هاوس الکترووینینگ.</li>
                    </ul>

                    <h3 className="text-lg font-semibold text-cyan-600 dark:text-cyan-500 pt-2 border-t border-gray-300 dark:border-gray-700">تفسیر نتایج</h3>
                    <ul className="list-disc list-inside space-y-2 pr-4">
                        <li><strong className="text-gray-800 dark:text-gray-100">انتقال خالص مس:</strong> یکی از مهم‌ترین پارامترهای اقتصادی که نشان می‌دهد به ازای هر درصد از استخراج‌کننده، چه مقدار مس به مدار الکترووینینگ منتقل می‌شود.</li>
                        <li><strong className="text-gray-800 dark:text-gray-100">بازیابی (Recovery):</strong> درصد مس استخراج شده از PLS و درصد مس استریپ شده از فاز آلی را نشان می‌دهد.</li>
                        <li><strong className="text-gray-800 dark:text-gray-100">نمودارهای McCabe-Thiele:</strong> این نمودارها به صورت بصری عملکرد مدار را نمایش می‌دهند. "منحنی تعادل" حداکثر انتقال ممکن را نشان می‌دهد و "خط عملیاتی" عملکرد واقعی مدار را. تعداد پله‌ها بین این دو خط، تعداد مراحل تئوری مورد نیاز برای رسیدن به جداسازی مطلوب را نشان می‌دهد.</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};


// Helper component for input rows
const InputRow = ({ label, name, value, onChange }) => (
    <div className="grid grid-cols-2 items-center gap-x-2">
        <label htmlFor={name} className="text-sm text-gray-700 dark:text-gray-400">{label}:</label>
        <input
            type="number"
            id={name}
            name={name}
            value={value}
            onChange={onChange}
            className="w-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white p-1.5 rounded-md border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-right"
            step="0.01"
        />
    </div>
);

// Helper component for displaying summary results
const ResultsSummary = ({ results }) => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
        <h2 className="text-xl font-semibold mb-4 text-cyan-600 dark:text-cyan-400">خلاصه نتایج بهینه‌سازی</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 text-center">
            <ResultCard label="درصد استخراج‌کننده (V%)" value={results.v_percent.toFixed(2)} unit="%" />
            <ResultCard label="انتقال خالص مس" value={results.stripping.netCu.toFixed(3)} unit="(g/L)/V%" />
            <ResultCard label="بازیابی استخراج" value={results.extraction.recovery.toFixed(2)} unit="%" />
            <ResultCard label="بازیابی استریپینگ" value={results.stripping.recovery.toFixed(2)} unit="%" />
            <ResultCard label="بارگذاری ماکزیمم (ML)" value={results.extraction.ml.toFixed(3)} unit="g/L" />
        </div>
    </div>
);

const ResultCard = ({ label, value, unit }) => (
    <div className="bg-gray-100 dark:bg-gray-700/50 p-4 rounded-lg">
        <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-300">{value}</div>
        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{label}</div>
        <div className="text-xs text-gray-500 dark:text-gray-500">{unit}</div>
    </div>
);

// Chart component
const ChartCard = ({ title, data }) => (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg h-96">
        <h3 className="text-lg font-semibold mb-4 text-center text-cyan-600 dark:text-cyan-400">{title}</h3>
        <ResponsiveContainer width="100%" height="85%">
            <LineChart margin={{ top: 5, right: 20, left: 20, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} stroke="#A0AEC0" tickFormatter={(tick) => tick.toFixed(2)}>
                     <Label value="غلظت مس در فاز آبی (g/L)" offset={-20} position="insideBottom" fill="#A0AEC0"/>
                </XAxis>
                <YAxis dataKey="y" type="number" domain={['dataMin', 'dataMax + 1']} stroke="#A0AEC0" tickFormatter={(tick) => tick.toFixed(2)}>
                    <Label value="غلظت مس در فاز آلی (g/L)" angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} fill="#A0AEC0"/>
                </YAxis>
                <Tooltip
                    contentStyle={{ backgroundColor: '#1A202C', border: '1px solid #4A5568' }}
                    labelStyle={{ color: '#E2E8F0' }}
                    formatter={(value, name) => [parseFloat(value).toFixed(3), name]}
                />
                <Legend wrapperStyle={{bottom: -5}}/>
                <Line type="monotone" data={data.equilibriumCurve} dataKey="y" name="منحنی تعادل" stroke="#2dd4bf" strokeWidth={2} dot={false} />
                <Line type="linear" data={data.operatingLine} dataKey="y" name="خط عملیاتی" stroke="#60a5fa" strokeWidth={2} dot={false} />
                <Scatter data={data.stages} fill="#facc15" name="مراحل"/>
            </LineChart>
        </ResponsiveContainer>
    </div>
);

// =================================================================
// CORE CALCULATION ENGINE
// This part contains all the mathematical formulas from the PDF
// =================================================================

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

export default App;
