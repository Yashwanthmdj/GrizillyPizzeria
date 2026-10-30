import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Analytics } from "@/services/analytics";

const COLORS = ["#AF2225", "#7E1519", "#EEC6A2", "#2A1412", "#F6E3D0"];

const tip = {
  contentStyle: { borderRadius: 16, border: "none", background: "#2A1412", color: "#FBF3EA" },
};

export default function InsightCharts({ data }: { data: Analytics }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Revenue over time">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data.revenueSeries}>
            <CartesianGrid stroke="#F6E3D0" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#2A1412", fontSize: 12 }} />
            <YAxis tick={{ fill: "#2A1412", fontSize: 12 }} />
            <Tooltip {...tip} />
            <Line type="monotone" dataKey="revenue" stroke="#AF2225" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Orders by hour">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.byHour}>
            <CartesianGrid stroke="#F6E3D0" vertical={false} />
            <XAxis dataKey="hour" tick={{ fill: "#2A1412", fontSize: 11 }} />
            <YAxis tick={{ fill: "#2A1412", fontSize: 12 }} />
            <Tooltip {...tip} />
            <Bar dataKey="orders" fill="#AF2225" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Best sellers">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.bestSellers} layout="vertical" margin={{ left: 24 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tick={{ fill: "#2A1412", fontSize: 12 }}
            />
            <Tooltip {...tip} />
            <Bar dataKey="qty" fill="#7E1519" radius={[0, 8, 8, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Categories">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={data.categories}
              dataKey="value"
              nameKey="name"
              innerRadius={58}
              outerRadius={90}
              paddingAngle={3}
            >
              {data.categories.map((entry, i) => (
                <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Legend />
            <Tooltip {...tip} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Payment method">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data.payments} dataKey="value" nameKey="name" outerRadius={80}>
              {data.payments.map((entry, i) => (
                <Cell key={entry.name} fill={i === 0 ? "#AF2225" : "#EEC6A2"} />
              ))}
            </Pie>
            <Legend />
            <Tooltip {...tip} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Outlet comparison">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.outlets}>
            <CartesianGrid stroke="#F6E3D0" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "#2A1412", fontSize: 12 }} />
            <YAxis tick={{ fill: "#2A1412", fontSize: 12 }} />
            <Tooltip {...tip} />
            <Bar dataKey="revenue" fill="#AF2225" radius={[8, 8, 0, 0]} />
            <Bar dataKey="orders" fill="#EEC6A2" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-card p-4 shadow-warm">
      <h2 className="mb-2 px-1 text-lg">{title}</h2>
      {children}
    </section>
  );
}
