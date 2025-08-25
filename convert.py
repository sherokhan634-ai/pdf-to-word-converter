from pdf2docx import Converter
import sys
import logging

logging.basicConfig(level=logging.INFO)

try:
    pdf_file = sys.argv[1]
    docx_file = sys.argv[2]
    logging.info(f"Converting {pdf_file} to {docx_file}")
    cv = Converter(pdf_file)
    cv.convert(docx_file)
    cv.close()
    logging.info("Conversion completed successfully")
except Exception as e:
    logging.error(f"Conversion failed: {str(e)}")
    sys.exit(1)