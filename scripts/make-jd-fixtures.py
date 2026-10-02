"""Genera JDs de prueba en tests/fixtures/jd/ (TXT, DOCX, PDF). Requiere: pip install fpdf2 python-docx"""
from pathlib import Path

import docx
from fpdf import FPDF

JD = """QA Automation Engineer Senior

Empresa: fintech en crecimiento con sede en Buenos Aires, modalidad híbrida (2 días en oficina).

Responsabilidades:
- Diseñar y mantener la estrategia de automatización de pruebas end-to-end y de API.
- Escribir y mantener tests con Cypress o Playwright en TypeScript.
- Integrar las suites de pruebas en pipelines de CI/CD (GitHub Actions).
- Colaborar con desarrolladores y producto en la definición de criterios de aceptación.
- Mentorear a QA manuales en buenas prácticas de automatización.

Requisitos:
- 5 o más años de experiencia en QA, al menos 3 en automatización.
- Experiencia sólida con Cypress o Playwright y testing de APIs (Postman, REST Assured).
- Conocimientos de SQL y de metodologías ágiles (Scrum).
- Inglés intermedio para reuniones con equipos de otros países.

Deseable:
- Experiencia en el sector financiero o fintech.
- Pruebas de performance con k6 o JMeter.
"""

out = Path("tests/fixtures/jd")
out.mkdir(parents=True, exist_ok=True)

(out / "jd-qa-senior.txt").write_text(JD, encoding="utf-8")

document = docx.Document()
for line in JD.splitlines():
    document.add_paragraph(line)
document.save(out / "jd-qa-senior.docx")

pdf = FPDF()
pdf.add_page()
pdf.set_font("Helvetica", size=11)
pdf.multi_cell(0, 6, JD)
pdf.output(str(out / "jd-qa-senior.pdf"))

(out / "jd-corta.txt").write_text("Buscamos QA con Cypress.", encoding="utf-8")
print("fixtures en", out)
