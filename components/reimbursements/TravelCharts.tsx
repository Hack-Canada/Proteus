"use client";

import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cad } from "@/lib/travel";

const regionConfig = {
  total: { label: "Requested", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

const bucketConfig = {
  count: { label: "People", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

type RegionPoint = { band: string; count: number; total: number };
type BucketPoint = { label: string; count: number; total: number };

export default function TravelCharts({
  regions,
  buckets,
}: {
  regions: RegionPoint[];
  buckets: BucketPoint[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Requested by distance from the venue</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={regionConfig} className="h-[260px] w-full">
            <BarChart data={regions} layout="vertical" margin={{ left: 8, right: 32 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="band"
                width={110}
                tickLine={false}
                axisLine={false}
                fontSize={12}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, _name, item) => (
                      <span>
                        {cad(Number(value))} · {item.payload.count}{" "}
                        {item.payload.count === 1 ? "person" : "people"}
                      </span>
                    )}
                  />
                }
              />
              <Bar dataKey="total" fill="hsl(var(--chart-1))" radius={8}>
                <LabelList
                  dataKey="count"
                  position="right"
                  className="fill-muted-foreground"
                  fontSize={12}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Requested amount</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={bucketConfig} className="h-[260px] w-full">
            <BarChart data={buckets} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis hide allowDecimals={false} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, _name, item) => (
                      <span>
                        {value} {Number(value) === 1 ? "person" : "people"} ·{" "}
                        {cad(item.payload.total)}
                      </span>
                    )}
                  />
                }
              />
              <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
