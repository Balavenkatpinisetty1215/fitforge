export function renderCharts(trendData) {
  const labels = trendData.map((d) => d.label);
  const userSeries = trendData.map((d) => d.userPoints);
  const squadSeries = trendData.map((d) => d.squadPoints);

  drawChart(
    "lineChart",
    labels,
    [
      { name: "You", data: userSeries, color: "#b9f45b" },
      { name: "Squad", data: squadSeries, color: "#69b7ff" }
    ],
    false
  );

  drawChart(
    "barChart",
    labels,
    [{ name: "Squad points", data: squadSeries, color: "#69b7ff" }],
    true
  );
}

function drawChart(canvasId, labels, datasets, isBar) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 400;
  const height = canvas.clientHeight || 225;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const pad = { left: 36, right: 12, top: 22, bottom: 28 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const maxVal = Math.max(10, ...datasets.flatMap((d) => d.data)) * 1.2;

  ctx.font = "11px system-ui, sans-serif";
  ctx.strokeStyle = "#29384d";
  ctx.fillStyle = "#91a0b5";
  ctx.lineWidth = 1;

  for (let step = 0; step <= 4; step++) {
    const y = pad.top + (plotH * step) / 4;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
    ctx.fillText(Math.round(maxVal * (1 - step / 4)), 4, y + 4);
  }

  labels.forEach((label, idx) => {
    const x = pad.left + (plotW * (idx + 0.5)) / labels.length;
    ctx.textAlign = "center";
    ctx.fillText(label, x, height - 8);
  });

  datasets.forEach((series) => {
    ctx.strokeStyle = series.color;
    ctx.fillStyle = series.color;
    ctx.lineWidth = 2.5;

    if (isBar) {
      const barWidth = (plotW / labels.length) * 0.48;
      series.data.forEach((val, idx) => {
        const x = pad.left + (plotW * (idx + 0.5)) / labels.length - barWidth / 2;
        const y = pad.top + plotH - (val / maxVal) * plotH;
        const barH = Math.max(2, pad.top + plotH - y);

        ctx.globalAlpha = 0.78;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barH, 5);
        ctx.fill();
        ctx.globalAlpha = 1;
      });
    } else {
      ctx.beginPath();
      series.data.forEach((val, idx) => {
        const x = pad.left + (plotW * (idx + 0.5)) / labels.length;
        const y = pad.top + plotH - (val / maxVal) * plotH;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      series.data.forEach((val, idx) => {
        const x = pad.left + (plotW * (idx + 0.5)) / labels.length;
        const y = pad.top + plotH - (val / maxVal) * plotH;
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  });

  ctx.textAlign = "left";
  let legendX = pad.left;
  datasets.forEach((series) => {
    ctx.fillStyle = series.color;
    ctx.fillRect(legendX, 4, 9, 9);
    ctx.fillStyle = "#aebbd0";
    ctx.fillText(series.name, legendX + 14, 12);
    legendX += ctx.measureText(series.name).width + 34;
  });
}
