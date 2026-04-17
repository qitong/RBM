const fs = require('fs');
const path = require('path');

const generateData = () => {
  const categories = [
    { id: 'INFORMED CONSENT', label: '知情同意', weight: 0.25 },
    { id: 'INCLUSION EXCLUSION', label: '入排标准', weight: 0.15 },
    { id: 'INVESTIGATIONAL PRODUCT', label: '试验用药', weight: 0.15 },
    { id: 'SAFETY REPORTING', label: '安全性报告', weight: 0.25 },
    { id: 'PROCEDURES TESTS', label: '访视与检查', weight: 0.05 },
    { id: 'VISIT SCHEDULE', label: '访视计划', weight: 0.05 },
    { id: 'CCMEDS', label: '合并用药', weight: 0.05 },
    { id: 'OTHER', label: '其他', weight: 0.05 }
  ];

  const progressMatrix = [];
  categories.forEach(cat => {
    for (let p = 10; p <= 100; p += 10) {
      const val = Math.random() * 3.5;
      progressMatrix.push({
        category: cat.id,
        label: cat.label,
        progress: p,
        value: parseFloat(val.toFixed(2)),
        alert_level: val >= 3.0 ? "Red" : val >= 2.0 ? "Yellow" : "Green"
      });
    }
  });

  const visitTrends = [];
  for (let v = 1; v <= 20; v++) {
    const entry = { visit: v };
    let weightedSum = 0;
    categories.forEach(cat => {
      const val = 0.5 + Math.random() * 2.0;
      entry[cat.id] = parseFloat(val.toFixed(2));
      weightedSum += val * cat.weight;
    });
    entry['Weighted_Overall'] = parseFloat(weightedSum.toFixed(2));
    visitTrends.push(entry);
  }

  const categoryList = categories;

  const alerts = [];
  // Ensure at least 3-5 alerts for demo
  const sampleSites = [101, 102, 105, 201, 203];
  categoryList.forEach((cat, idx) => {
    if (idx < 5) { // First 5 categories often have alerts
      alerts.push({
        id: `ALR-${1000 + alerts.length}`,
        project: "ADV-2024",
        site: sampleSites[idx],
        dimension: cat.id,
        metricValue: 2.5 + Math.random() * 1.5,
        status: Math.random() > 0.5 ? "Open" : "In Review"
      });
    }
  });

  const finalData = {
    progressMatrix,
    visitTrends,
    categoryList,
    alerts
  };

  const outputPath = path.join(__dirname, 'frontend/src/data.json');
  fs.writeFileSync(outputPath, JSON.stringify(finalData, null, 2));
  console.log('Mock data generated at:', outputPath);
};

generateData();
