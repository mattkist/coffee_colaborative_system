// Timeline chart component - shows contributions over time
import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

export function TimelineChart({ contributions }) {
  const chartRef = useRef(null)
  const chartInstanceRef = useRef(null)

  useEffect(() => {
    if (!chartRef.current || !contributions || contributions.length === 0) return

    // Initialize chart
    if (!chartInstanceRef.current) {
      chartInstanceRef.current = echarts.init(chartRef.current)
    }

    const chart = chartInstanceRef.current

    // Process data by month
    const monthlyData = {}
    
    contributions.forEach(contrib => {
      const date = contrib.purchaseDate?.toDate?.() || new Date(contrib.purchaseDate)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthKey,
          kg: 0,
          value: 0
        }
      }
      
      monthlyData[monthKey].kg += contrib.quantityKg || 0
      monthlyData[monthKey].value += contrib.value || 0
    })

    // Sort by month
    const sortedMonths = Object.keys(monthlyData).sort()
    const months = sortedMonths.map(key => {
      const date = new Date(key + '-01')
      return date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
    })
    const kgData = sortedMonths.map(key => monthlyData[key].kg)

    // Chart configuration
    const option = {
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const param = params[0]
          return `${param.name}<br/>${param.value.toFixed(2)} kg`
        }
      },
      grid: {
        left: '10%',
        right: '10%',
        top: '10%',
        bottom: '15%'
      },
      xAxis: {
        type: 'category',
        data: months,
        axisLabel: {
          rotate: 45,
          fontSize: 10
        }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: '{value} kg'
        }
      },
      series: [
        {
          type: 'bar',
          data: kgData,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#A0522D' },
              { offset: 1, color: '#DEB887' }
            ])
          },
          label: {
            show: true,
            position: 'top',
            formatter: '{c} kg'
          }
        }
      ]
    }

    chart.setOption(option)

    // Handle resize
    const handleResize = () => {
      chart.resize()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.dispose()
      chartInstanceRef.current = null
    }
  }, [contributions])

  if (!contributions || contributions.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>
        Sem dados disponíveis
      </div>
    )
  }

  return (
    <div
      ref={chartRef}
      style={{
        width: '100%',
        height: '300px',
        minHeight: '200px'
      }}
    />
  )
}



