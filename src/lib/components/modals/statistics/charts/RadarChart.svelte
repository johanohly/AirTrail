<script lang="ts">
  import { Axis, Chart, Group, Points, Spline, Svg } from 'layerchart';
  import { scaleBand } from 'd3-scale';

  let { data }: { data: Record<string, number> } = $props();
</script>

<div class="w-full p-4 border rounded h-[200px]">
  <Chart
    data={Object.entries(data).map(([key, value]) => ({
      label: `${key} (${value})`,
      value,
    }))}
    x="label"
    xScale={scaleBand()}
    xRange={[0, 2 * Math.PI]}
    y="value"
    yRange={({ height }) => [0, height / 2]}
    yPadding={[0, 10]}
    padding={{ top: 32, bottom: 8 }}
  >
    <Svg>
      <Group center>
        <Axis
          placement="radius"
          grid={{ class: 'stroke-surface-content/20 fill-surface-200/50' }}
          format={(d) => ''}
        />
        <Axis
          placement="angle"
          grid={{ class: 'stroke-surface-content/20' }}
          tickLabelProps={{ class: 'text-xs' }}
        />
        <Spline radial class="stroke-primary fill-primary/20" />
        <Points radial class="fill-primary stroke-surface-200" />
      </Group>
    </Svg>
  </Chart>
</div>
