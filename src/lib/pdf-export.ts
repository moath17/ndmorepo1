/**
 * PDF export utility for assessment results.
 * Uses jsPDF + jspdf-autotable for client-side PDF generation.
 * Generates a clean HTML-based PDF to properly support Arabic text.
 */

interface CategoryScore {
  name: string;
  score: number;
  yesCount: number;
  partialCount: number;
  noCount: number;
  total: number;
}

interface ExportData {
  title: string;
  subtitle: string;
  overallScore: number;
  complianceLevel: string;
  recommendation: string;
  categoryScores: CategoryScore[];
  labels: {
    yes: string;
    partial: string;
    no: string;
    score: string;
    category: string;
    recommendation: string;
    overallScore: string;
    generatedAt: string;
    compliant: string;
    partiallyCompliant: string;
    nonCompliant: string;
    exportTitle: string;
  };
  isRTL: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 75) return "#059669";
  if (score >= 40) return "#d97706";
  return "#dc2626";
}

function getScoreBgColor(score: number): string {
  if (score >= 75) return "#ecfdf5";
  if (score >= 40) return "#fffbeb";
  return "#fef2f2";
}

function getComplianceIcon(score: number): string {
  if (score >= 75) return "&#10003;"; // checkmark
  if (score >= 40) return "&#9888;"; // warning
  return "&#10007;"; // X mark
}

/**
 * Generate and download an HTML-based printable PDF report.
 * Uses a new window with print styles for proper Arabic/RTL support.
 */
export function exportAssessmentPDF(data: ExportData) {
  const dir = data.isRTL ? "rtl" : "ltr";
  const fontFamily = data.isRTL
    ? "'Noto Kufi Arabic', 'Segoe UI', Tahoma, sans-serif"
    : "'Segoe UI', Tahoma, sans-serif";
  const align = data.isRTL ? "right" : "left";
  const now = new Date();
  const dateStr = now.toLocaleDateString(data.isRTL ? "ar-SA" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const categoryRows = data.categoryScores
    .map((cat) => {
      const color = getScoreColor(cat.score);
      const bg = getScoreBgColor(cat.score);
      const icon = getComplianceIcon(cat.score);
      return `
        <tr style="background:${bg}">
          <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-weight:600">${cat.name}</td>
          <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:center">
            <span style="color:${color};font-weight:700;font-size:18px">${cat.score}%</span>
          </td>
          <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:center;color:#059669">${cat.yesCount}</td>
          <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:center;color:#d97706">${cat.partialCount}</td>
          <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:center;color:#dc2626">${cat.noCount}</td>
          <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:center">
            <span style="color:${color}">${icon}</span>
          </td>
        </tr>
      `;
    })
    .join("");

  const overallColor = getScoreColor(data.overallScore);

  // Build progress bars for each category
  const categoryBars = data.categoryScores
    .map((cat) => {
      const color = getScoreColor(cat.score);
      return `
        <div style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="font-size:13px;font-weight:600;color:#374151">${cat.name}</span>
            <span style="font-size:13px;font-weight:700;color:${color}">${cat.score}%</span>
          </div>
          <div style="background:#e5e7eb;border-radius:8px;height:10px;overflow:hidden">
            <div style="background:${color};height:100%;width:${cat.score}%;border-radius:8px;transition:width 0.3s"></div>
          </div>
        </div>
      `;
    })
    .join("");

  const html = `
<!DOCTYPE html>
<html lang="${data.isRTL ? "ar" : "en"}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <title>${data.title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: ${fontFamily};
      direction: ${dir};
      text-align: ${align};
      color: #1f2937;
      background: #fff;
      padding: 0;
      line-height: 1.6;
    }
    @media print {
      body { padding: 0; }
      .page-break { page-break-before: always; }
      .no-print { display: none !important; }
    }
    .container { max-width: 800px; margin: 0 auto; padding: 40px 32px; }
    .header {
      text-align: center;
      padding: 40px 20px;
      background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
      color: white;
      border-radius: 16px;
      margin-bottom: 32px;
    }
    .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
    .header p { font-size: 14px; opacity: 0.85; }
    .score-card {
      text-align: center;
      padding: 32px;
      background: #f8fafc;
      border: 2px solid #e2e8f0;
      border-radius: 16px;
      margin-bottom: 32px;
    }
    .score-circle {
      width: 140px; height: 140px;
      border-radius: 50%;
      border: 8px solid ${overallColor};
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      margin-bottom: 16px;
      background: white;
    }
    .score-number { font-size: 42px; font-weight: 700; color: ${overallColor}; line-height: 1; }
    .score-percent { font-size: 16px; color: ${overallColor}; }
    .score-label { font-size: 18px; font-weight: 600; color: ${overallColor}; margin-top: 8px; }
    .section {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .section-title {
      font-size: 18px;
      font-weight: 700;
      color: #1e40af;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #dbeafe;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    thead th {
      padding: 12px 16px;
      background: #1e40af;
      color: white;
      font-weight: 600;
      text-align: ${align};
    }
    thead th:not(:first-child) { text-align: center; }
    .recommendation-box {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .recommendation-box h3 { color: #1e40af; font-size: 16px; margin-bottom: 8px; }
    .recommendation-box p { font-size: 14px; color: #374151; }
    .footer {
      text-align: center;
      padding: 20px;
      color: #9ca3af;
      font-size: 12px;
      border-top: 1px solid #e5e7eb;
      margin-top: 32px;
    }
    .print-btn {
      position: fixed; bottom: 20px; ${data.isRTL ? "left" : "right"}: 20px;
      background: #1e40af; color: white; border: none;
      padding: 12px 24px; border-radius: 8px; cursor: pointer;
      font-size: 14px; font-weight: 600; z-index: 999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .print-btn:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>${data.title}</h1>
      <p>${data.subtitle}</p>
    </div>

    <!-- Overall Score -->
    <div class="score-card">
      <div class="score-circle">
        <span class="score-number">${data.overallScore}</span>
        <span class="score-percent">%</span>
      </div>
      <div class="score-label">${data.complianceLevel}</div>
      <p style="font-size:13px;color:#6b7280;margin-top:8px">${data.labels.overallScore}</p>
    </div>

    <!-- Recommendation -->
    <div class="recommendation-box">
      <h3>${data.labels.recommendation}</h3>
      <p>${data.recommendation}</p>
    </div>

    <!-- Category Progress Bars -->
    <div class="section">
      <h2 class="section-title">${data.labels.category}</h2>
      ${categoryBars}
    </div>

    <!-- Detailed Table -->
    <div class="section">
      <h2 class="section-title">${data.labels.exportTitle || data.title}</h2>
      <table>
        <thead>
          <tr>
            <th>${data.labels.category}</th>
            <th>${data.labels.score}</th>
            <th>${data.labels.yes}</th>
            <th>${data.labels.partial}</th>
            <th>${data.labels.no}</th>
            <th>-</th>
          </tr>
        </thead>
        <tbody>
          ${categoryRows}
        </tbody>
      </table>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>${data.labels.generatedAt}: ${dateStr}</p>
      <p style="margin-top:4px">NDMO Data Governance - ${data.isRTL ? "تقرير تقييم الامتثال" : "Compliance Assessment Report"}</p>
    </div>
  </div>

  <button class="print-btn no-print" onclick="window.print()">
    ${data.isRTL ? "طباعة / تحميل PDF" : "Print / Download PDF"}
  </button>
</body>
</html>`;

  // Open in a new window for print/save as PDF
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    // Auto-trigger print after fonts load
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 500);
    };
  }
}
