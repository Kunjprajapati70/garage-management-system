import { Box, Card, Typography, useTheme } from '@mui/material'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartCaption, EmptyState } from '@/components/ui'

function compactAxis(value: number) {
  const amount = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (amount >= 10000000) return `${sign}₹${(amount / 10000000).toFixed(1)}Cr`
  if (amount >= 100000) return `${sign}₹${(amount / 100000).toFixed(1)}L`
  if (amount >= 1000) return `${sign}₹${Math.round(amount / 1000)}k`
  return `${sign}₹${amount}`
}

function AxisTick({
  x = 0,
  y = 0,
  payload,
  fill,
  tilt,
}: {
  x?: number
  y?: number
  payload?: { value?: string | number }
  fill: string
  tilt: boolean
}) {
  const label = String(payload?.value ?? '')
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        fill={fill}
        fontSize={11}
        textAnchor={tilt ? 'end' : 'middle'}
        transform={tilt ? 'rotate(-38)' : undefined}
        dy={tilt ? 6 : 14}
      >
        {label}
      </text>
    </g>
  )
}

export function AxisChart({
  title,
  data,
  xKey,
  yKey,
  xLabel,
  yLabel,
  color,
  angled,
  formatter,
}: {
  title: string
  data: Record<string, string | number>[]
  xKey: string
  yKey: string
  xLabel: string
  yLabel: string
  color?: string
  angled?: boolean
  formatter?: (value: number) => string
}) {
  const theme = useTheme()
  const ink = theme.palette.text.primary
  const muted = theme.palette.text.secondary
  const fill = color || theme.palette.primary.main
  const longest = data.reduce((max, row) => Math.max(max, String(row[xKey] ?? '').length), 0)
  const tilt = Boolean(angled) || longest > 8 || data.length > 8
  const slot = tilt ? 84 : 72
  const chartMinWidth = Math.max(560, data.length * slot)
  return (
    <Card sx={{ p: { xs: 1.5, sm: 2 }, height: '100%', minWidth: 0, maxWidth: '100%' }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>{title}</Typography>
      {!data.length ? (
        <EmptyState title="Nothing in this range" body="Change the dates or wait for workshop activity to appear here." />
      ) : (
        <Box sx={{ overflowX: 'auto', overflowY: 'hidden', width: '100%', minWidth: 0, maxWidth: '100%', pb: 0.5, WebkitOverflowScrolling: 'touch' }}>
          <Box sx={{ width: chartMinWidth, minWidth: chartMinWidth, height: tilt ? 390 : 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 12, right: 16, left: 8, bottom: 8 }} barCategoryGap="22%">
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
                <XAxis
                  dataKey={xKey}
                  interval={0}
                  height={tilt ? 108 : 64}
                  tickMargin={10}
                  tick={(props) => <AxisTick {...props} fill={muted} tilt={tilt} />}
                  label={{ value: xLabel, position: 'insideBottom', offset: 0, fill: ink, fontSize: 13 }}
                />
                <YAxis
                  width={108}
                  allowDecimals={false}
                  tick={{ fill: muted, fontSize: 11 }}
                  tickMargin={6}
                  tickFormatter={(value) => (formatter ? compactAxis(Number(value)) : String(value))}
                  label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: 4, style: { textAnchor: 'middle', fill: ink, fontSize: 12 } }}
                />
                <Tooltip
                  formatter={(value) => [formatter ? formatter(Number(value || 0)) : value, yLabel]}
                  labelFormatter={(label) => `${xLabel}: ${label}`}
                  contentStyle={{ background: theme.palette.background.paper, borderColor: theme.palette.divider, color: ink, borderRadius: 10 }}
                />
                <Bar dataKey={yKey} name={yLabel} fill={fill} radius={[6, 6, 0, 0]} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Box>
      )}
      <ChartCaption x={xLabel} y={yLabel} />
    </Card>
  )
}
