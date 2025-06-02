import React, { useState, useCallback } from 'react';
import { Upload, BarChart3, PieChart, TrendingUp, Download, FileText, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Cell, LineChart, Line, ScatterChart, Scatter } from 'recharts';
import Papa from 'papaparse';
import _ from 'lodash';

const DataAnalyzerApp = () => {
  const [data, setData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [fileName, setFileName] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [activeTab, setActiveTab] = useState('upload');
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [chartType, setChartType] = useState('bar');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1', '#d084d0', '#ffb347'];

  const handleFileUpload = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a CSV file');
      return;
    }

    setIsLoading(true);
    setError('');
    setFileName(file.name);

    Papa.parse(file, {
      complete: (results) => {
        try {
          if (results.errors.length > 0) {
            console.warn('Parse warnings:', results.errors);
          }

          const cleanedData = results.data
            .filter(row => row.some(cell => cell && cell.toString().trim() !== ''))
            .map(row => row.map(cell => cell ? cell.toString().trim() : ''));

          if (cleanedData.length < 2) {
            setError('CSV file must contain at least a header row and one data row');
            setIsLoading(false);
            return;
          }

          const headerRow = cleanedData[0];
          const dataRows = cleanedData.slice(1);

          const processedData = dataRows.map((row, index) => {
            const rowObj = { _index: index };
            headerRow.forEach((header, colIndex) => {
              const value = row[colIndex] || '';
              const numValue = parseFloat(value);
              rowObj[header] = isNaN(numValue) ? value : numValue;
            });
            return rowObj;
          });

          setHeaders(headerRow);
          setData(processedData);
          setSelectedColumns([headerRow[0], headerRow[1]].filter(Boolean));
          performAnalysis(processedData, headerRow);
          setActiveTab('analyze');
        } catch (err) {
          setError('Error processing CSV file: ' + err.message);
        } finally {
          setIsLoading(false);
        }
      },
      header: false,
      skipEmptyLines: true,
      dynamicTyping: false,
      delimitersToGuess: [',', ';', '\t', '|']
    });
  }, []);

  const performAnalysis = (dataset, headerList) => {
    const numericColumns = headerList.filter(header => {
      return dataset.some(row => typeof row[header] === 'number' && !isNaN(row[header]));
    });

    const categoricalColumns = headerList.filter(header => {
      return dataset.some(row => typeof row[header] === 'string' && row[header] !== '');
    });

    const summary = {
      totalRows: dataset.length,
      totalColumns: headerList.length,
      numericColumns: numericColumns.length,
      categoricalColumns: categoricalColumns.length,
      missingValues: headerList.reduce((acc, header) => {
        const missing = dataset.filter(row => !row[header] || row[header] === '').length;
        if (missing > 0) acc[header] = missing;
        return acc;
      }, {})
    };

    const numericStats = {};
    numericColumns.forEach(col => {
      const values = dataset.map(row => row[col]).filter(val => typeof val === 'number' && !isNaN(val));
      if (values.length > 0) {
        numericStats[col] = {
          min: Math.min(...values),
          max: Math.max(...values),
          mean: _.mean(values),
          median: values.sort((a, b) => a - b)[Math.floor(values.length / 2)],
          stdDev: Math.sqrt(_.mean(values.map(v => Math.pow(v - _.mean(values), 2))))
        };
      }
    });

    const categoricalStats = {};
    categoricalColumns.forEach(col => {
      const values = dataset.map(row => row[col]).filter(val => val && val !== '');
      if (values.length > 0) {
        const grouped = _.groupBy(values);
        categoricalStats[col] = _.mapValues(grouped, group => group.length);
      }
    });

    setAnalysis({
      summary,
      numericStats,
      categoricalStats,
      numericColumns,
      categoricalColumns
    });
  };

  const generateChartData = () => {
    if (!data.length || selectedColumns.length < 1) return [];

    const [xCol, yCol] = selectedColumns;
    
    if (chartType === 'pie' && xCol) {
      const grouped = _.groupBy(data, xCol);
      return Object.entries(grouped).map(([key, group]) => ({
        name: key,
        value: group.length,
        percentage: ((group.length / data.length) * 100).toFixed(1)
      })).slice(0, 10);
    }

    if (chartType === 'scatter' && xCol && yCol) {
      return data.filter(row => 
        typeof row[xCol] === 'number' && typeof row[yCol] === 'number'
      ).map(row => ({
        x: row[xCol],
        y: row[yCol],
        name: `${xCol}: ${row[xCol]}, ${yCol}: ${row[yCol]}`
      }));
    }

    if (yCol && typeof data[0][yCol] === 'number') {
      const grouped = _.groupBy(data, xCol);
      return Object.entries(grouped).map(([key, group]) => ({
        name: key,
        value: _.mean(group.map(item => item[yCol])),
        count: group.length
      })).slice(0, 15);
    }

    const grouped = _.groupBy(data, xCol);
    return Object.entries(grouped).map(([key, group]) => ({
      name: key,
      value: group.length
    })).slice(0, 15);
  };

  const renderChart = () => {
    const chartData = generateChartData();
    if (!chartData.length) return <div className="text-gray-500 text-center py-8">No data to display</div>;

    const commonProps = {
      width: '100%',
      height: 400,
      data: chartData
    };

    switch (chartType) {
      case 'bar':
        return (
          <ResponsiveContainer {...commonProps}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                angle={-45} 
                textAnchor="end" 
                height={80}
                interval={0}
              />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer {...commonProps}>
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                angle={-45} 
                textAnchor="end" 
                height={80}
              />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#8884d8" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer {...commonProps}>
            <RechartsPieChart>
              <RechartsPieChart
                data={chartData}
                cx="50%"
                cy="50%"
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percentage }) => `${name} (${percentage}%)`}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </RechartsPieChart>
              <Tooltip formatter={(value) => [value, 'Count']} />
            </RechartsPieChart>
          </ResponsiveContainer>
        );

      case 'scatter':
        return (
          <ResponsiveContainer {...commonProps}>
            <ScatterChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" type="number" />
              <YAxis dataKey="y" type="number" />
              <Tooltip formatter={(value, name) => [value, name]} />
              <Scatter dataKey="y" fill="#8884d8" />
            </ScatterChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  const exportAnalysis = () => {
    if (!analysis) return;

    const report = {
      fileName,
      timestamp: new Date().toISOString(),
      summary: analysis.summary,
      numericStatistics: analysis.numericStats,
      categoricalStatistics: analysis.categoricalStats
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analysis_${fileName.replace('.csv', '')}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Data Analyzer Pro</h1>
          <p className="text-gray-600">Upload, analyze, and visualize your CSV data</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-lg p-1 shadow-lg">
            {[
              { id: 'upload', label: 'Upload', icon: Upload },
              { id: 'analyze', label: 'Analyze', icon: BarChart3 },
              { id: 'visualize', label: 'Visualize', icon: TrendingUp }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                disabled={id !== 'upload' && !data.length}
                className={`px-6 py-3 rounded-md font-medium transition-all duration-200 flex items-center gap-2 ${
                  activeTab === id
                    ? 'bg-blue-500 text-white shadow-md'
                    : data.length || id === 'upload'
                    ? 'text-gray-600 hover:text-blue-500 hover:bg-blue-50'
                    : 'text-gray-400 cursor-not-allowed'
                }`}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-2">
            <AlertCircle className="text-red-500" size={20} />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="text-center">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 hover:border-blue-400 transition-colors">
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Upload Your CSV File</h3>
                <p className="text-gray-500 mb-6">Drag and drop or click to select your data file</p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-upload"
                  disabled={isLoading}
                />
                <label
                  htmlFor="csv-upload"
                  className={`inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 cursor-pointer transition-colors ${
                    isLoading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isLoading ? 'Processing...' : 'Choose File'}
                </label>
              </div>
              
              {fileName && (
                <div className="mt-6 p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="text-green-600" size={20} />
                    <span className="text-green-800 font-medium">{fileName}</span>
                  </div>
                  <p className="text-green-600 text-sm mt-1">Successfully loaded {data.length} rows</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Analysis Tab */}
        {activeTab === 'analyze' && analysis && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Data Analysis Summary</h2>
                <button
                  onClick={exportAnalysis}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Download size={18} />
                  Export Report
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-800">Total Rows</h3>
                  <p className="text-2xl font-bold text-blue-600">{analysis.summary.totalRows}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <h3 className="font-semibold text-green-800">Total Columns</h3>
                  <p className="text-2xl font-bold text-green-600">{analysis.summary.totalColumns}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <h3 className="font-semibold text-purple-800">Numeric Columns</h3>
                  <p className="text-2xl font-bold text-purple-600">{analysis.summary.numericColumns}</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-4">
                  <h3 className="font-semibold text-orange-800">Text Columns</h3>
                  <p className="text-2xl font-bold text-orange-600">{analysis.summary.categoricalColumns}</p>
                </div>
              </div>

              {/* Numeric Statistics */}
              {Object.keys(analysis.numericStats).length > 0 && (
                <div className="mb-8">
                  <h3 className="text-xl font-semibold mb-4">Numeric Column Statistics</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-300 px-4 py-2 text-left">Column</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Min</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Max</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Mean</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Median</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Std Dev</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(analysis.numericStats).map(([col, stats]) => (
                          <tr key={col}>
                            <td className="border border-gray-300 px-4 py-2 font-medium">{col}</td>
                            <td className="border border-gray-300 px-4 py-2">{stats.min.toFixed(2)}</td>
                            <td className="border border-gray-300 px-4 py-2">{stats.max.toFixed(2)}</td>
                            <td className="border border-gray-300 px-4 py-2">{stats.mean.toFixed(2)}</td>
                            <td className="border border-gray-300 px-4 py-2">{stats.median.toFixed(2)}</td>
                            <td className="border border-gray-300 px-4 py-2">{stats.stdDev.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Missing Values */}
              {Object.keys(analysis.summary.missingValues).length > 0 && (
                <div>
                  <h3 className="text-xl font-semibold mb-4">Missing Values</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(analysis.summary.missingValues).map(([col, count]) => (
                      <div key={col} className="bg-yellow-50 rounded-lg p-4">
                        <h4 className="font-medium text-yellow-800">{col}</h4>
                        <p className="text-yellow-600">{count} missing values</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Visualization Tab */}
        {activeTab === 'visualize' && data.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Data Visualization</h2>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Chart Type</label>
                <select
                  value={chartType}
                  onChange={(e) => setChartType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="bar">Bar Chart</option>
                  <option value="line">Line Chart</option>
                  <option value="pie">Pie Chart</option>
                  <option value="scatter">Scatter Plot</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">X-Axis Column</label>
                <select
                  value={selectedColumns[0] || ''}
                  onChange={(e) => setSelectedColumns([e.target.value, selectedColumns[1]])}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select column...</option>
                  {headers.map(header => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </div>

              {chartType !== 'pie' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Y-Axis Column (optional)</label>
                  <select
                    value={selectedColumns[1] || ''}
                    onChange={(e) => setSelectedColumns([selectedColumns[0], e.target.value])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select column...</option>
                    {headers.map(header => (
                      <option key={header} value={header}>{header}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              {renderChart()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataAnalyzerApp;
