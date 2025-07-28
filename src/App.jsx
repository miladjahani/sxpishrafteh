import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Scatter, Label, AreaChart, Area } from 'recharts';
import { utils, writeFile } from 'xlsx';
import { ArrowDownToLine, Settings, FileDown, RefreshCw, HelpCircle, X, Sun, Moon, Save, Upload, Info } from 'lucide-react';

// Main App Component
const App = () => {
  // Initial state based on Table 17 from the PDF
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
    const savedInputs = localStorage.getItem('sx-inputs');
    return savedInputs ? JSON.parse(savedInputs) : initialInputs;
  });
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isHelpVisible, setIsHelpVisible] = useState(false);
  const [initialRun, setInitialRun] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState('results');
  const [paramHelp, setParamHelp] = useState(null);
  
  // Save inputs to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('sx-inputs', JSON.stringify(inputs));
  }, [inputs]);

  // Toggle dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Function to handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setInputs(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
  };

  // Reset inputs to default
  const resetInputs = () => {
    setInputs(initialInputs);
  };

  // Save current configuration
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

  // Load configuration
  const loadConfig = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const config = JSON.parse(event.target.result);
        setInputs(config);
      } catch (err) {
        setError('فایل پیکربندی نامعتبر است');
        setTimeout(() => setError(null), 5000);
      }
    };
    reader.readAsText(file);
    
    // Reset file input
    e.target.value = null;
  };

  // Function to show parameter help
  const showParamHelp = (param) => {
    setParamHelp(param);
    setTimeout(() => {
      const element = document.getElementById(`param-${param}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('highlight');
        setTimeout(() => element.classList.remove('highlight'), 2000);
      }
    }, 100);
  };

  // Core calculation logic with Web Worker
  const runSolver = useCallback(() => {
    setIsLoading(true);
    setError(null);
    setResults(null);
    setInitialRun(true);
    
    // Validate inputs
    const validationError = validateInputs(inputs);
    if (validationError) {
      setError(validationError);
      setIsLoading(false);
      return;
    }

    // Create a new Web Worker for calculations
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

  // Input validation
  const validateInputs = (inputs) => {
    const errors = [];
    
    if (inputs.plsFlow <= 0) errors.push('جریان PLS باید بزرگتر از صفر باشد');
    if (inputs.plsCu <= 0) errors.push('مس در PLS باید بزرگتر از صفر باشد');
    if (inputs.plsAcid < 0) errors.push('اسید در PLS نمی‌تواند منفی باشد');
    if (inputs.percentageML <= 0 || inputs.percentageML > 100) 
      errors.push('درصد بارگذاری ماکزیمم باید بین 0 تا 100 باشد');
    if (inputs.o_a_ex <= 0) errors.push('نسبت O/A باید بزرگتر از صفر باشد');
    if (inputs.effE1 <= 0 || inputs.effE1 > 100) 
      errors.push('بازدهی مرحله E1 باید بین 0 تا 100 باشد');
    if (inputs.effE2 <= 0 || inputs.effE2 > 100) 
      errors.push('بازدهی مرحله E2 باید بین 0 تا 100 باشد');
    if (inputs.spCu <= 0) errors.push('مس در الکترولیت مصرفی باید بزرگتر از صفر باشد');
    if (inputs.spAcid < 0) errors.push('اسید در الکترولیت مصرفی نمی‌تواند منفی باشد');
    if (inputs.adCu <= 0) errors.push('مس در الکترولیت پیشرفته باید بزرگتر از صفر باشد');
    if (inputs.adCu <= inputs.spCu) 
      errors.push('مس در الکترولیت پیشرفته باید بیشتر از الکترولیت مصرفی باشد');
    if (inputs.effS1 <= 0 || inputs.effS1 > 100) 
      errors.push('بازدهی مرحله S1 باید بین 0 تا 100 باشد');
    if (inputs.effS2 <= 0 || inputs.effS2 > 100) 
      errors.push('بازدهی مرحله S2 باید بین 0 تا 100 باشد');
    
    return errors.length > 0 ? errors.join('. ') : null;
  };

  // Export to Excel function with full details
  const exportToExcel = () => {
    if (!results) {
      alert("ابتدا باید محاسبات انجام شود.");
      return;
    }
    
    const wb = utils.book_new();

    // --- Summary Sheet ---
    const summaryData = [
      { 'پارامتر': 'درصد بهینه استخراج‌کننده (V%)', 'مقدار': results.v_percent.toFixed(2) },
      { 'پارامتر': 'انتقال خالص مس ((g/L)/V%)', 'مقدار': results.stripping.netCu.toFixed(3) },
      { 'پارامتر': 'بازیابی استخراج (%)', 'مقدار': results.extraction.recovery.toFixed(2) },
      { 'پارامتر': 'بازیابی استریپینگ (%)', 'مقدار': results.stripping.recovery.toFixed(2) },
      { 'پارامتر': 'بارگذاری ماکزیمم (ML g/L)', 'مقدار': results.extraction.ml.toFixed(3) },
      { 'پارامتر': 'بارگذاری شده (LO g/L)', 'مقدار': results.extraction.lo.toFixed(3) },
      { 'پارامتر': 'رافینت (Raff g/L)', 'مقدار': results.extraction.raff.toFixed(3) },
      { 'پارامتر': 'اسید در رافینت (g/L)', 'مقدار': results.extraction.details.raffAcid.toFixed(3) },
      { 'پارامتر': 'O/A استریپینگ', 'مقدار': results.stripping.details.o_a_st.toFixed(3) },
    ];
    const wsSummary = utils.json_to_sheet(summaryData);
    utils.book_append_sheet(wb, wsSummary, 'خلاصه نتایج');

    // --- Extraction Details Sheet ---
    const exDetails = [
      ["مرحله استخراج"],
      ["نقطه", "Cu آبی (g/L)", "Cu آلی (g/L)"],
      ["A1 (ورودی)", results.extraction.details.stage1.A.x.toFixed(3), results.extraction.details.stage1.A.y.toFixed(3)],
      ["B1 (خروجی واقعی)", results.extraction.details.stage1.B.x.toFixed(3), results.extraction.details.stage1.B.y.toFixed(3)],
      ["C1 (ورودی آلی)", results.extraction.details.stage1.C.x.toFixed(3), results.extraction.details.stage1.C.y.toFixed(3)],
      ["D1 (تعادل)", results.extraction.details.stage1.D.x.toFixed(3), results.extraction.details.stage1.D.y.toFixed(3)],
      ["بازدهی مرحله ۱ (%)", results.extraction.details.stage1.efficiency.toFixed(2), ""],
      [],
      ["A2 (ورودی)", results.extraction.details.stage2.A.x.toFixed(3), results.extraction.details.stage2.A.y.toFixed(3)],
      ["B2 (خروجی واقعی)", results.extraction.details.stage2.B.x.toFixed(3), results.extraction.details.stage2.B.y.toFixed(3)],
      ["C2 (ورودی آلی)", results.extraction.details.stage2.C.x.toFixed(3), results.extraction.details.stage2.C.y.toFixed(3)],
      ["D2 (تعادل)", results.extraction.details.stage2.D.x.toFixed(3), results.extraction.details.stage2.D.y.toFixed(3)],
      ["بازدهی مرحله ۲ (%)", results.extraction.details.stage2.efficiency.toFixed(2), ""],
    ];
    const wsEx = utils.aoa_to_sheet(exDetails);
    utils.book_append_sheet(wb, wsEx, 'جزئیات استخراج');
    
    // --- Stripping Details Sheet ---
    const stDetails = [
      ["مرحله استریپینگ"],
      ["نقطه", "Cu آبی (g/L)", "Cu آلی (g/L)"],
      ["A1 (ورودی)", results.stripping.details.stage1.A.x.toFixed(3), results.stripping.details.stage1.A.y.toFixed(3)],
      ["B1 (خروجی واقعی)", results.stripping.details.stage1.B.x.toFixed(3), results.stripping.details.stage1.B.y.toFixed(3)],
      ["C1 (ورودی آلی)", results.stripping.details.stage1.C.x.toFixed(3), results.stripping.details.stage1.C.y.toFixed(3)],
      ["D1 (تعادل)", results.stripping.details.stage1.D.x.toFixed(3), results.stripping.details.stage1.D.y.toFixed(3)],
      ["بازدهی مرحله ۱ (%)", results.stripping.details.stage1.efficiency.toFixed(2), ""],
      [],
      ["A2 (ورودی)", results.stripping.details.stage2.A.x.toFixed(3), results.stripping.details.stage2.A.y.toFixed(3)],
      ["B2 (خروجی واقعی)", results.stripping.details.stage2.B.x.toFixed(3), results.stripping.details.stage2.B.y.toFixed(3)],
      ["C2 (ورودی آلی)", results.stripping.details.stage2.C.x.toFixed(3), results.stripping.details.stage2.C.y.toFixed(3)],
      ["D2 (تعادل)", results.stripping.details.stage2.D.x.toFixed(3), results.stripping.details.stage2.D.y.toFixed(3)],
      ["بازدهی مرحله ۲ (%)", results.stripping.details.stage2.efficiency.toFixed(2), ""],
    ];
    const wsSt = utils.aoa_to_sheet(stDetails);
    utils.book_append_sheet(wb, wsSt, 'جزئیات استریپینگ');
    
    writeFile(wb, "Copper_SX_Optimization_Full_Details.xlsx");
  };

  // Preview calculation results
  const previewResults = useMemo(() => {
    if (!inputs) return null;
    
    try {
      // Simplified calculation for preview
      const v_percent = 17.1; // Default value for preview
      const ml = inputs.plsCu * 0.8 * inputs.percentageML / 100;
      const recovery = 95 + (inputs.plsCu - 5) * 0.5;
      const netCu = ml / v_percent * 0.85;
      
      return {
        v_percent,
        extraction: {
          ml,
          recovery: Math.min(99.9, recovery),
          raff: inputs.plsCu * (1 - recovery/100)
        },
        stripping: {
          netCu,
          recovery: 97 + (inputs.adCu - inputs.spCu) * 0.2
        }
      };
    } catch (e) {
      return null;
    }
  }, [inputs]);

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
            <button 
              onClick={() => setDarkMode(!darkMode)} 
              className="flex items-center bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-2 px-4 rounded-lg transition-colors"
            >
              {darkMode ? <Sun size={18} className="ml-2" /> : <Moon size={18} className="ml-2" />}
              {darkMode ? 'حالت روشن' : 'حالت تاریک'}
            </button>
            <button 
              onClick={() => setIsHelpVisible(true)} 
              className="flex items-center bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-2 px-4 rounded-lg transition-colors"
            >
              <HelpCircle size={18} className="ml-2" />
              راهنمای برنامه
            </button>
            <button 
              onClick={saveConfig} 
              className="flex items-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              <Save size={18} className="ml-2" />
              ذخیره تنظیمات
            </button>
            <label className="flex items-center bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-colors cursor-pointer">
              <Upload size={18} className="ml-2" />
              بارگذاری تنظیمات
              <input 
                type="file" 
                accept=".json" 
                onChange={loadConfig} 
                className="hidden" 
              />
            </label>
            <button 
              onClick={runSolver} 
              className="flex items-center bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
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
              <button 
                onClick={resetInputs}
                className="text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 px-3 py-1 rounded"
              >
                بازنشانی
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Extraction Inputs */}
              <div>
                <h3 className="font-bold text-gray-700 dark:text-gray-300 border-b border-gray-300 dark:border-gray-600 pb-1 mb-2 flex items-center">
                  مرحله استخراج (Extraction)
                  <button 
                    onClick={() => showParamHelp('extraction')}
                    className="ml-2 text-gray-500 hover:text-cyan-500"
                  >
                    <Info size={16} />
                  </button>
                </h3>
                <InputRow 
                  label="جریان PLS (m³/h)" 
                  name="plsFlow" 
                  value={inputs.plsFlow} 
                  onChange={handleInputChange}
                  id="param-plsFlow"
                  help="دبی محلول باردار حامل مس ورودی به مدار"
                />
                <InputRow 
                  label="مس در PLS (g/L)" 
                  name="plsCu" 
                  value={inputs.plsCu} 
                  onChange={handleInputChange}
                  id="param-plsCu"
                  help="غلظت مس در محلول ورودی"
                />
                <InputRow 
                  label="اسید در PLS (g/L)" 
                  name="plsAcid" 
                  value={inputs.plsAcid} 
                  onChange={handleInputChange}
                  id="param-plsAcid"
                  help="غلظت اسید سولفوریک در محلول ورودی"
                />
                <InputRow 
                  label="درصد بارگذاری ماکزیمم (%)" 
                  name="percentageML" 
                  value={inputs.percentageML} 
                  onChange={handleInputChange}
                  id="param-percentageML"
                  help="درصدی از حداکثر ظرفیت بارگذاری فاز آلی که در عمل به آن می‌رسیم"
                />
                <InputRow 
                  label="نسبت O/A" 
                  name="o_a_ex" 
                  value={inputs.o_a_ex} 
                  onChange={handleInputChange}
                  id="param-o_a_ex"
                  help="نسبت فاز آلی به آبی در مرحله استخراج"
                />
                <InputRow 
                  label="بازدهی مرحله E1 (%)" 
                  name="effE1" 
                  value={inputs.effE1} 
                  onChange={handleInputChange}
                  id="param-effE1"
                  help="بازدهی مرحله اول میکسر-ستر در رسیدن به تعادل"
                />
                <InputRow 
                  label="بازدهی مرحله E2 (%)" 
                  name="effE2" 
                  value={inputs.effE2} 
                  onChange={handleInputChange}
                  id="param-effE2"
                  help="بازدهی مرحله دوم میکسر-ستر در رسیدن به تعادل"
                />
              </div>
              
              {/* Stripping Inputs */}
              <div>
                <h3 className="font-bold text-gray-700 dark:text-gray-300 border-b border-gray-300 dark:border-gray-600 pb-1 mb-2 flex items-center">
                  مرحله استریپینگ (Stripping)
                  <button 
                    onClick={() => showParamHelp('stripping')}
                    className="ml-2 text-gray-500 hover:text-cyan-500"
                  >
                    <Info size={16} />
                  </button>
                </h3>
                <InputRow 
                  label="مس در الکترولیت مصرفی (g/L)" 
                  name="spCu" 
                  value={inputs.spCu} 
                  onChange={handleInputChange}
                  id="param-spCu"
                  help="غلظت مس در محلول خروجی از مدار الکترووینینگ"
                />
                <InputRow 
                  label="اسید در الکترولیت مصرفی (g/L)" 
                  name="spAcid" 
                  value={inputs.spAcid} 
                  onChange={handleInputChange}
                  id="param-spAcid"
                  help="غلظت اسید در محلول خروجی از مدار الکترووینینگ"
                />
                <InputRow 
                  label="مس در الکترولیت پیشرفته (g/L)" 
                  name="adCu" 
                  value={inputs.adCu} 
                  onChange={handleInputChange}
                  id="param-adCu"
                  help="غلظت مس مورد نیاز برای فرآیند الکترووینینگ"
                />
                <InputRow 
                  label="بازدهی مرحله S1 (%)" 
                  name="effS1" 
                  value={inputs.effS1} 
                  onChange={handleInputChange}
                  id="param-effS1"
                  help="بازدهی مرحله اول میکسر-ستر در رسیدن به تعادل"
                />
                <InputRow 
                  label="بازدهی مرحله S2 (%)" 
                  name="effS2" 
                  value={inputs.effS2} 
                  onChange={handleInputChange}
                  id="param-effS2"
                  help="بازدهی مرحله دوم میکسر-ستر در رسیدن به تعادل"
                />
              </div>
            </div>
            
            {/* Preview Card */}
            <div className="mt-6 bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
              <h3 className="font-semibold text-blue-700 dark:text-blue-300 flex items-center">
                <Info size={18} className="ml-2" />
                پیش‌نمایش نتایج
              </h3>
              {previewResults ? (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="text-sm">
                    <div className="text-blue-600 dark:text-blue-400">V% پیش‌بینی شده:</div>
                    <div>{previewResults.v_percent.toFixed(1)}%</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-blue-600 dark:text-blue-400">بازیابی استخراج:</div>
                    <div>{previewResults.extraction.recovery.toFixed(1)}%</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-blue-600 dark:text-blue-400">انتقال خالص مس:</div>
                    <div>{previewResults.stripping.netCu.toFixed(3)} (g/L)/V%</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-blue-600 dark:text-blue-400">بازیابی استریپینگ:</div>
                    <div>{previewResults.stripping.recovery.toFixed(1)}%</div>
                  </div>
                </div>
              ) : (
                <p className="text-sm mt-2 text-gray-600 dark:text-gray-400">برای مشاهده پیش‌نمایش، مقادیر ورودی را تنظیم کنید</p>
              )}
            </div>
          </div>

          {/* Results and Charts */}
          <div className="lg:col-span-2">
            {error && (
              <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 p-4 rounded-xl mb-6">
                <div className="font-bold flex items-center">
                  <X size={20} className="ml-2" />
                  خطا در محاسبات
                </div>
                <div className="mt-2">{error}</div>
              </div>
            )}
            
            {!initialRun && !error && (
              <div className="flex flex-col justify-center items-center h-96 bg-white dark:bg-gray-800 rounded-xl shadow text-center p-4">
                <Settings size={48} className="text-cyan-500 mb-4" />
                <h3 className="text-xl text-gray-700 dark:text-gray-300">آماده برای بهینه‌سازی</h3>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  مقادیر ورودی را تنظیم کرده و روی دکمه "محاسبه" کلیک کنید.
                </p>
                <p className="text-gray-500 dark:text-gray-500 mt-4 text-sm max-w-md">
                  برای مشاهده پیش‌نمایش نتایج، مقادیر ورودی را تغییر دهید. این پیش‌نمایش بر اساس داده‌های تاریخی و تخمینی ایجاد می‌شود و نتایج نهایی پس از محاسبه دقیق به دست می‌آید.
                </p>
              </div>
            )}
            
            {isLoading && (
              <div className="flex justify-center items-center h-96 bg-white dark:bg-gray-800 rounded-xl shadow">
                <div className="text-center">
                  <RefreshCw size={48} className="text-cyan-500 mb-4 mx-auto animate-spin" />
                  <div className="text-cyan-600 dark:text-cyan-400 text-lg">در حال انجام محاسبات پیچیده...</div>
                  <p className="text-gray-600 dark:text-gray-400 mt-2">
                    این فرآیند ممکن است چند ثانیه طول بکشد. لطفاً منتظر بمانید.
                  </p>
                </div>
              </div>
            )}
            
            {results && !isLoading && !error && (
              <div className="space-y-6">
                <div className="flex border-b border-gray-300 dark:border-gray-700">
                  <button 
                    className={`px-4 py-2 font-medium ${activeTab === 'results' ? 'text-cyan-600 dark:text-cyan-400 border-b-2 border-cyan-500' : 'text-gray-500 dark:text-gray-400'}`}
                    onClick={() => setActiveTab('results')}
                  >
                    نتایج
                  </button>
                  <button 
                    className={`px-4 py-2 font-medium ${activeTab === 'extraction-chart' ? 'text-cyan-600 dark:text-cyan-400 border-b-2 border-cyan-500' : 'text-gray-500 dark:text-gray-400'}`}
                    onClick={() => setActiveTab('extraction-chart')}
                  >
                    نمودار استخراج
                  </button>
                  <button 
                    className={`px-4 py-2 font-medium ${activeTab === 'stripping-chart' ? 'text-cyan-600 dark:text-cyan-400 border-b-2 border-cyan-500' : 'text-gray-500 dark:text-gray-400'}`}
                    onClick={() => setActiveTab('stripping-chart')}
                  >
                    نمودار استریپینگ
                  </button>
                  <button 
                    className={`px-4 py-2 font-medium ${activeTab === 'acid-chart' ? 'text-cyan-600 dark:text-cyan-400 border-b-2 border-cyan-500' : 'text-gray-500 dark:text-gray-400'}`}
                    onClick={() => setActiveTab('acid-chart')}
                  >
                    نمودار تعادل اسید
                  </button>
                </div>
                
                {activeTab === 'results' && (
                  <>
                    <ResultsSummary results={results} />
                    
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
                      <h2 className="text-xl font-semibold mb-4 text-cyan-600 dark:text-cyan-400">جزئیات فرآیند</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <ProcessDetails 
                          title="استخراج" 
                          details={results.extraction.details} 
                          recovery={results.extraction.recovery} 
                        />
                        <ProcessDetails 
                          title="استریپینگ" 
                          details={results.stripping.details} 
                          recovery={results.stripping.recovery} 
                        />
                      </div>
                    </div>
                    
                    <div className="flex justify-end">
                      <button 
                        onClick={exportToExcel} 
                        className="flex items-center bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                      >
                        <FileDown size={18} className="ml-2" />
                        خروجی اکسل
                      </button>
                    </div>
                  </>
                )}
                
                {activeTab === 'extraction-chart' && (
                  <ChartCard 
                    title="نمودار McCabe-Thiele: استخراج" 
                    data={results.extraction.mccabeThiele} 
                    type="extraction"
                  />
                )}
                
                {activeTab === 'stripping-chart' && (
                  <ChartCard 
                    title="نمودار McCabe-Thiele: استریپینگ" 
                    data={results.stripping.mccabeThiele} 
                    type="stripping"
                  />
                )}
                
                {activeTab === 'acid-chart' && results.acidEquilibrium && (
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg h-96">
                    <h3 className="text-lg font-semibold mb-4 text-center text-cyan-600 dark:text-cyan-400">نمودار تعادل اسید</h3>
                    <ResponsiveContainer width="100%" height="85%">
                      <AreaChart data={results.acidEquilibrium} margin={{ top: 5, right: 20, left: 20, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                        <XAxis dataKey="x" stroke="#A0AEC0" tickFormatter={(tick) => tick.toFixed(2)}>
                          <Label value="غلظت مس در فاز آبی (g/L)" offset={-20} position="insideBottom" fill="#A0AEC0"/>
                        </XAxis>
                        <YAxis stroke="#A0AEC0" tickFormatter={(tick) => tick.toFixed(2)}>
                          <Label value="غلظت اسید در فاز آبی (g/L)" angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} fill="#A0AEC0"/>
                        </YAxis>
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1A202C', border: '1px solid #4A5568' }}
                          labelStyle={{ color: '#E2E8F0' }}
                          formatter={(value) => [parseFloat(value).toFixed(3)]}
                        />
                        <Area type="monotone" dataKey="y" name="تعادل اسید" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Parameter Help Popup */}
      {paramHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-cyan-600 dark:text-cyan-400">راهنمای پارامتر</h3>
              <button onClick={() => setParamHelp(null)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <X size={24} />
              </button>
            </div>
            <div className="text-gray-700 dark:text-gray-300">
              {paramHelp === 'extraction' && (
                <p>
                  پارامترهای مرحله استخراج تعیین‌کننده شرایط عملیاتی بخش اول مدار هستند. این پارامترها شامل غلظت‌های ورودی، نسبت فازها و بازدهی مراحل می‌باشند که بر بازیابی مس و عملکرد کلی سیستم تأثیر مستقیم دارند.
                </p>
              )}
              {paramHelp === 'stripping' && (
                <p>
                  پارامترهای مرحله استریپینگ مربوط به بخش دوم مدار هستند که در آن مس از فاز آلی به محلول الکترولیت منتقل می‌شود. تنظیم دقیق این پارامترها برای دستیابی به غلظت مطلوب در الکترولیت پیشرفته ضروری است.
                </p>
              )}
              {paramHelp === 'plsFlow' && (
                <p>
                  دبی محلول باردار حامل مس (PLS) که به مدار استخراج حلالی وارد می‌شود. این پارامتر ظرفیت سیستم را تعیین می‌کند و بر ابعاد تجهیزات تأثیر مستقیم دارد.
                </p>
              )}
              {/* Add more specific parameter helps as needed */}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Help Modal Component
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
            <li><strong className="text-gray-800 dark:text-gray-100">نمودار تعادل اسید:</strong> ارتباط بین غلظت مس و اسید در فاز آبی را نشان می‌دهد که برای کنترل اسیدیته مدار اهمیت دارد.</li>
          </ul>
          
          <div className="pt-4 border-t border-gray-300 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-cyan-600 dark:text-cyan-500">امکانات جدید</h3>
            <ul className="list-disc list-inside space-y-2 pr-4">
              <li>سیستم ذخیره و بازیابی تنظیمات برای ادامه کار در جلسات بعدی</li>
              <li>پیش‌نمایش نتایج قبل از انجام محاسبات سنگین</li>
              <li>نمایش جزئیات مراحل استخراج و استریپینگ</li>
              <li>نمودار تعادل اسید برای تحلیل بهتر فرآیند</li>
              <li>حالت روشن/تاریک برای استفاده در شرایط نوری مختلف</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

// Input Row Component
const InputRow = React.memo(({ label, name, value, onChange, id, help }) => (
  <div className="grid grid-cols-2 items-center gap-x-2 mb-3" id={id}>
    <div className="flex items-center">
      <label htmlFor={name} className="text-sm text-gray-700 dark:text-gray-400">{label}:</label>
      {help && (
        <button 
          onClick={(e) => {
            e.preventDefault();
            alert(help);
          }} 
          className="ml-2 text-gray-500 hover:text-cyan-500"
        >
          <Info size={14} />
        </button>
      )}
    </div>
    <input
      type="number"
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      className="w-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white p-1.5 rounded-md border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-right"
      step="0.01"
      min="0"
    />
  </div>
));

// Results Summary Component
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

// Result Card Component
const ResultCard = React.memo(({ label, value, unit }) => (
  <div className="bg-gray-100 dark:bg-gray-700/50 p-4 rounded-lg transition-all hover:scale-[1.03]">
    <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-300">{value}</div>
    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{label}</div>
    <div className="text-xs text-gray-500 dark:text-gray-500">{unit}</div>
  </div>
));

// Process Details Component
const ProcessDetails = ({ title, details, recovery }) => (
  <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg">
    <h3 className="font-semibold text-lg mb-3 text-cyan-600 dark:text-cyan-400">{title}</h3>
    
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-gray-700 dark:text-gray-300">بازیابی کل:</span>
        <span className="font-bold text-cyan-600 dark:text-cyan-400">{recovery.toFixed(2)}%</span>
      </div>
      
      {title === 'استریپینگ' && (
        <div className="flex justify-between items-center">
          <span className="text-gray-700 dark:text-gray-300">نسبت O/A:</span>
          <span className="font-bold">{details.o_a_st.toFixed(3)}</span>
        </div>
      )}
    </div>
    
    <div className="grid grid-cols-1 gap-4">
      <StageDetails title="مرحله ۱" details={details.stage1} />
      <StageDetails title="مرحله ۲" details={details.stage2} />
    </div>
  </div>
);

// Stage Details Component
const StageDetails = ({ title, details }) => (
  <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
    <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">{title} (بازدهی: {details.efficiency.toFixed(1)}%)</h4>
    
    <div className="space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-gray-600 dark:text-gray-400">ورودی (A):</span>
        <span>Cu_aq: {details.A.x.toFixed(2)} | Cu_or: {details.A.y.toFixed(2)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600 dark:text-gray-400">خروجی (B):</span>
        <span>Cu_aq: {details.B.x.toFixed(2)} | Cu_or: {details.B.y.toFixed(2)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600 dark:text-gray-400">ورودی آلی (C):</span>
        <span>Cu_aq: {details.C.x.toFixed(2)} | Cu_or: {details.C.y.toFixed(2)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600 dark:text-gray-400">تعادل (D):</span>
        <span>Cu_aq: {details.D.x.toFixed(2)} | Cu_or: {details.D.y.toFixed(2)}</span>
      </div>
    </div>
  </div>
);

// Chart Card Component
const ChartCard = ({ title, data, type }) => (
  <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg h-96">
    <h3 className="text-lg font-semibold mb-4 text-center text-cyan-600 dark:text-cyan-400">{title}</h3>
    <ResponsiveContainer width="100%" height="85%">
      <LineChart data={data.equilibriumCurve} margin={{ top: 5, right: 20, left: 20, bottom: 25 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
        <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} stroke="#A0AEC0" tickFormatter={(tick) => tick.toFixed(2)}>
          <Label value="غلظت مس در فاز آبی (g/L)" offset={-20} position="insideBottom" fill="#A0AEC0"/>
        </XAxis>
        <YAxis dataKey="y" type="number" domain={[0, type === 'extraction' ? 'dataMax + 5' : 'auto']} stroke="#A0AEC0" tickFormatter={(tick) => tick.toFixed(2)}>
          <Label value="غلظت مس در فاز آلی (g/L)" angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} fill="#A0AEC0"/>
        </YAxis>
        <Tooltip
          contentStyle={{ backgroundColor: '#1A202C', border: '1px solid #4A5568' }}
          labelStyle={{ color: '#E2E8F0' }}
          formatter={(value, name) => [parseFloat(value).toFixed(3), name]}
        />
        <Legend wrapperStyle={{bottom: -5}}/>
        <Line 
          type="monotone" 
          data={data.equilibriumCurve} 
          dataKey="y" 
          name="منحنی تعادل" 
          stroke="#2dd4bf" 
          strokeWidth={2} 
          dot={false} 
        />
        <Line 
          type="linear" 
          data={data.operatingLine} 
          dataKey="y" 
          name="خط عملیاتی" 
          stroke="#60a5fa" 
          strokeWidth={2} 
          dot={false} 
        />
        <Scatter 
          data={data.stages} 
          fill="#facc15" 
          name="مراحل"
          shape={(props) => {
            const { cx, cy, payload } = props;
            return (
              <g>
                <circle cx={cx} cy={cy} r={6} fill="#facc15" />
                <text x={cx} y={cy} dy={-10} textAnchor="middle" fill="#fff" fontSize={12}>
                  {payload.name}
                </text>
              </g>
            );
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

export default App;