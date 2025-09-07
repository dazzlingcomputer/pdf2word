import React, { useState } from 'react'

function App() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleUpload = async () => {
    if (!file) return
    setLoading(true)
    setError(null)

    try {
      if (import.meta.env.VITE_WORKER_URL) {
        // 上传到 Worker
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch(import.meta.env.VITE_WORKER_URL, {
          method: 'POST',
          body: formData
        })

        if (!response.ok) throw new Error('转换失败')
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = file.name.replace(/\.pdf$/, '') + '.docx'
        a.click()
      } else {
        throw new Error('未设置后端服务，请配置 VITE_WORKER_URL')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen space-y-4">
      <h1 className="text-2xl font-bold">PDF 转 Word</h1>
      <input type="file" accept="application/pdf" onChange={e => setFile(e.target.files[0])} />
      <button
        onClick={handleUpload}
        disabled={!file || loading}
        className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
      >
        {loading ? '转换中...' : '开始转换'}
      </button>
      {error && <p className="text-red-500">{error}</p>}
    </div>
  )
}

export default App