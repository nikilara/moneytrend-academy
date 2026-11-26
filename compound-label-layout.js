/** Keep labels on their true X anchors; use another vertical lane only on collision. */
export function packLabelPositions(items, containerWidth, gap = 8, rowGap = 8) {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) {
    return { positions: [], totalHeight: 0, rows: 0 };
  }
  const lanes = [];
  const positions = [];
  for (const item of items) {
    const width = Math.max(1, Math.min(containerWidth, item.width));
    const height = Math.max(1, item.height);
    const left = item.centerX - width / 2;
    const right = item.centerX + width / 2;
    let row = lanes.findIndex(lane => lane.intervals.every(interval =>
      right + gap <= interval.left || left >= interval.right + gap));
    if (row === -1) {
      row = lanes.length;
      lanes.push({ intervals: [], height: 0 });
    }
    lanes[row].intervals.push({ left, right });
    lanes[row].height = Math.max(lanes[row].height, height);
    positions.push({ ...item, width, height, row, left, right });
  }
  let top = 0;
  const rowTops = lanes.map(lane => {
    const value = top;
    top += lane.height + rowGap;
    return value;
  });
  return {
    positions: positions.map(item => ({ ...item, top: rowTops[item.row] })),
    totalHeight: Math.max(0, top - (lanes.length ? rowGap : 0)),
    rows: lanes.length
  };
}

/** Reserve enough horizontal room for centered edge labels inside the same plot. */
export function boundsForLabels(base, { chartWidth, chartOffset, containerWidth, maxLabelWidth }, edgeGap = 2) {
  if (!(chartWidth > 0) || !(containerWidth > 0)) return { ...base };
  const halfWidth = Math.min(maxLabelWidth, containerWidth - edgeGap * 2) / 2;
  const leftPixels = Math.max(base.left / base.viewWidth * chartWidth, halfWidth + edgeGap - chartOffset);
  const rightPixels = Math.min(base.right / base.viewWidth * chartWidth,
    containerWidth - chartOffset - halfWidth - edgeGap);
  // A standard 320px viewport leaves much more than this; retain a usable domain
  // for unusually narrow embedding containers without moving labels off their anchors.
  const left = Math.max(0, Math.min(chartWidth - 1, leftPixels));
  const right = Math.max(left + 1, Math.min(chartWidth, rightPixels));
  return { ...base, left: left / chartWidth * base.viewWidth, right: right / chartWidth * base.viewWidth };
}
