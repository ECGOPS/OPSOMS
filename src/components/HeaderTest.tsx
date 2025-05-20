import React, { useEffect, useState } from 'react';
import { testSecurityHeaders } from '../utils/headerTest';

interface HeaderTestResult {
  header: string;
  expected: string;
  actual: string | null;
  status: string;
  details?: string;
}

export const HeaderTest: React.FC = () => {
  const [results, setResults] = useState<HeaderTestResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runTest = async () => {
    setLoading(true);
    setError(null);
    try {
      const testResults = await testSecurityHeaders();
      console.log('Test results:', testResults); // Debug log
      setResults(testResults);
    } catch (err) {
      console.error('Test error:', err); // Debug log
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const resetTest = () => {
    setResults([]);
    setError(null);
  };

  useEffect(() => {
    runTest();
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Security Headers Test</h2>
      
      <div className="flex gap-2 mb-4">
        <button
          onClick={runTest}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
        >
          {loading ? 'Testing...' : 'Run Test'}
        </button>
        <button
          onClick={resetTest}
          disabled={loading || results.length === 0}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-400"
        >
          Reset
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
          Error: {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2 border">Header</th>
              <th className="px-4 py-2 border">Expected</th>
              <th className="px-4 py-2 border">Actual</th>
              <th className="px-4 py-2 border">Status</th>
              <th className="px-4 py-2 border">Details</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result, index) => (
              <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                <td className="px-4 py-2 border font-mono">{result.header}</td>
                <td className="px-4 py-2 border font-mono text-sm">{result.expected}</td>
                <td className="px-4 py-2 border font-mono text-sm">{result.actual || 'Not Set'}</td>
                <td className="px-4 py-2 border text-center">{result.status}</td>
                <td className="px-4 py-2 border text-sm text-red-600 whitespace-pre-wrap">
                  {result.details || ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Debug information */}
      <div className="mt-4 p-4 bg-gray-100 rounded">
        <h3 className="font-bold mb-2">Debug Information:</h3>
        <pre className="text-sm">
          {JSON.stringify(results, null, 2)}
        </pre>
      </div>
    </div>
  );
}; 