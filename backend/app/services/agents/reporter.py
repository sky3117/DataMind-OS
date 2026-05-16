from typing import List, Dict, Any
from datetime import datetime
import logging
from io import BytesIO

try:
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    HAS_REPORTLAB = True
except ImportError:
    HAS_REPORTLAB = False

logger = logging.getLogger(__name__)


class ReporterAgent:
    """Generate PDF reports from analysis."""

    @staticmethod
    async def generate_report(
        title: str,
        sections: List[str],
        include_charts: bool = True,
        analysis_data: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        """Generate a PDF report."""

        if not HAS_REPORTLAB:
            logger.warning("ReportLab not available, returning mock report")
            return {
                "report_id": "report_mock_123",
                "pdf_url": "/reports/report_mock_123.pdf",
                "generated_at": datetime.utcnow().isoformat(),
                "page_count": 3,
                "message": "Report generated successfully (mock)",
            }

        try:
            pdf_buffer = BytesIO()
            doc = SimpleDocTemplate(pdf_buffer, pagesize=letter)
            story = []

            styles = getSampleStyleSheet()
            title_style = ParagraphStyle(
                "CustomTitle",
                parent=styles["Heading1"],
                fontSize=24,
                textColor="#1a365d",
                spaceAfter=30,
            )

            story.append(Paragraph(title, title_style))
            story.append(Spacer(1, 0.3 * inch))

            if "summary" in sections:
                story.append(Paragraph("Summary", styles["Heading2"]))
                story.append(
                    Paragraph(
                        "This report contains analysis and insights from the data.",
                        styles["Normal"],
                    )
                )
                story.append(Spacer(1, 0.2 * inch))

            if "analysis" in sections:
                story.append(Paragraph("Data Analysis", styles["Heading2"]))
                story.append(
                    Paragraph(
                        "Statistical analysis of key metrics and distributions.",
                        styles["Normal"],
                    )
                )
                story.append(Spacer(1, 0.2 * inch))

            if "insights" in sections:
                story.append(Paragraph("Key Insights", styles["Heading2"]))
                story.append(
                    Paragraph(
                        "Notable patterns and correlations identified in the data.",
                        styles["Normal"],
                    )
                )
                story.append(Spacer(1, 0.2 * inch))

            if "recommendations" in sections:
                story.append(Paragraph("Recommendations", styles["Heading2"]))
                story.append(
                    Paragraph(
                        "Suggested actions based on the analysis.",
                        styles["Normal"],
                    )
                )
                story.append(Spacer(1, 0.2 * inch))

            if "appendix" in sections:
                story.append(PageBreak())
                story.append(Paragraph("Appendix", styles["Heading2"]))
                story.append(
                    Paragraph(
                        "Detailed data tables and methodology.",
                        styles["Normal"],
                    )
                )

            doc.build(story)
            pdf_buffer.seek(0)

            return {
                "report_id": "report_123",
                "pdf_url": "/reports/report_123.pdf",
                "generated_at": datetime.utcnow().isoformat(),
                "page_count": 3,
                "message": "Report generated successfully",
            }

        except Exception as e:
            logger.error(f"Error generating report: {str(e)}")
            raise
