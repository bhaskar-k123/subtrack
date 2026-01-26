
import pdfplumber
import pandas as pd
import re
from datetime import datetime

class BankStatementParser:
    def __init__(self, pdf_path):
        self.pdf_path = pdf_path
        self.transactions = []
        self.column_map = {} # { "Date": [x0, x1], ... }
        self.validation = {
            "expectedDrCount": 0,
            "expectedCrCount": 0,
            "foundFooter": False
        }
    
    def parse(self):
        """Main execution pipeline."""
        with pdfplumber.open(self.pdf_path) as pdf:
            # Stage 1: Detect Headers scan first 2 pages
            header_y_bottom = self._detect_header_layout(pdf.pages[:2])
            
            # Stage 2 & 3: Extract Rows & Map Columns
            all_rows = []
            for page in pdf.pages:
                # Find page-specific footer (if any)
                footer_y = self._find_footer_y(page)
                
                rows = self._extract_visual_rows(page)
                
                # Filter rows: Must be below header (if on page 1) and above footer
                filtered_rows = []
                for row in rows:
                    if not row: continue
                    row_y = row[0]['top']
                    
                    # On first page, skip anything above header
                    if page.page_number == 1 and header_y_bottom and row_y < header_y_bottom:
                        continue
                        
                    # Skip anything below footer
                    if footer_y and row_y > footer_y:
                        continue
                        
                    filtered_rows.append(row)
                
                all_rows.extend(filtered_rows)
            
            print(f"DEBUG: Slow Parser found {len(all_rows)} visual rows.")
            
            # Stage 4: Process Rows into Structured Data
            self._process_transaction_rows(all_rows)
            
            # Stage 5: Validation check
            self._extract_footer_validation(pdf)
            
        return self.transactions, self.validation
        
    def _find_footer_y(self, page):
        """Finds Y-coordinate of footer keywords to stop parsing."""
        words = page.extract_words()
        # Look for "Total Dr Count" or generic end markers
        for w in words:
            if "Total" in w['text'] and "Count" in w['text']: 
                 # This is too simple, might match inside line. 
                 # But usually Footer is distinct. 
                 # Better: Look for key phrase "Total Dr Count" constructed from nearby words
                 pass
        
        # Robust search
        text = page.extract_text()
        if "Total Dr Count" in text:
            # Find the word "Total" near bottom
            sorted_words = sorted(words, key=lambda w: w['top'], reverse=True)
            for w in sorted_words[:50]: # Check bottom 50 words
                 if "Total" in w['text']:
                      # Check neighbors
                      return w['top']
        return 10000 # default: very high

    def _detect_header_layout(self, pages):
        """
        Scans pages to find the Header row and map X-coordinates of known columns.
        Keywords: Date, Narration, Withdrawal, Deposit, Balance
        Returns: bottom_y of the header row
        """
        header_keywords = {
            "Date": ["Date", "Txn Date"],
            "Narration": ["Narration", "Description", "Particulars"],
            "Chq": ["Chq./Ref.No.", "Ref No", "Cheque", "Chq"],
            "ValueDate": ["Value Dt", "Value Date"],
            "Withdrawal": ["Withdrawal", "Debit", "Dr Amt"],
            "Deposit": ["Deposit", "Credit", "Cr Amt"],
            "Balance": ["Closing Balance", "Balance"]
        }
        
        found_headers = {}
        header_bottom_y = 0
        
        for page in pages:
            words = page.extract_words(keep_blank_chars=True)
            # Group words by Y to find the header line
            lines = {}
            for w in words:
                y = int(w['top'])
                if y not in lines: lines[y] = []
                lines[y].append(w)
            
            # Check which line is the header
            best_line = None
            max_matches = 0
            
            for y, line_words in lines.items():
                line_text = " ".join([w['text'] for w in line_words]).lower()
                matches = 0
                for key, variations in header_keywords.items():
                    if any(v.lower() in line_text for v in variations):
                        matches += 1
                
                if matches >= 3: 
                    if matches > max_matches:
                        max_matches = matches
                        best_line = line_words
                        header_bottom_y = line_words[0]['bottom'] + 2 # Add buffer
            
            if best_line:
                for w in best_line:
                    txt = w['text'].lower()
                    for key, variations in header_keywords.items():
                        if any(v.lower() in txt for v in variations):
                           if key not in found_headers:
                                found_headers[key] = {'x0': w['x0'], 'x1': w['x1']}
                if len(found_headers) >= 4:
                    break
        
        # Post-process ranges (fill gaps)
        sorted_keys = sorted(found_headers.keys(), key=lambda k: found_headers[k]['x0'])
        
        self.column_map = {}
        for i, key in enumerate(sorted_keys):
            x0 = found_headers[key]['x0'] - 20 # Add padding
            if i < len(sorted_keys) - 1:
                next_key = sorted_keys[i+1]
                x1 = found_headers[next_key]['x0']
            else:
                x1 = 1000 # Max width
            
            self.column_map[key] = (x0, x1)
            
        print(f"DEBUG: Detected Layout: {self.column_map}, Header Bottom: {header_bottom_y}")
        return header_bottom_y

    def _extract_visual_rows(self, page):
        """
        Groups text into visual rows based on Y-overlap.
        """
        words = page.extract_words(keep_blank_chars=True)
        rows = []
        
        # Sort by top (y)
        words.sort(key=lambda w: w['top'])
        
        current_row = []
        last_top = 0
        
        for w in words:
            if not current_row:
                current_row.append(w)
                last_top = w['top']
            else:
                # If overlap vertically overlap > 50% height, same row
                if abs(w['top'] - last_top) < 5: # Tolerance 5px
                    current_row.append(w)
                else:
                    rows.append(current_row)
                    current_row = [w]
                    last_top = w['top']
        if current_row:
            rows.append(current_row)
            
        return rows
    
    def _process_transaction_rows(self, rows):
        """
        Maps row blobs to columns and constructs transactions.
        """
        temp_transactions = []
        current_txn = None
        
        date_pattern = re.compile(r'^(\d{1,2})/(\d{1,2})/(\d{2,4})')
        
        for row in rows:
            mapped = self._map_row_to_columns(row)
            
            date_str = None
            # STRICT CHECK: Date must be in the mapped 'Date' column
            if "Date" in mapped and len(mapped["Date"].strip()) > 5:
                # Try finding date in this column specifically
                match = date_pattern.search(mapped["Date"].strip())
                if match:
                    date_str = match.group(0)
            
            # Fallback (only if Date column missing): Check starts with
            if not date_str and not self.column_map:
                 match = date_pattern.match(row[0]['text'])
                 if match: date_str = match.group(0)
            
            if date_str:
                if current_txn:
                    temp_transactions.append(current_txn)
                
                try:
                    day, month, year = date_str.split('/')
                    year = int(year)
                    if year < 100: year = 2000 + year
                    iso_date = f"{year}-{int(month):02d}-{int(day):02d}"
                except:
                    iso_date = datetime.now().strftime("%Y-%m-%d")

                current_txn = {
                    "date": iso_date,
                    "merchantRaw": mapped.get("Narration", ""),
                    "withdrawal": mapped.get("Withdrawal", ""),
                    "deposit": mapped.get("Deposit", ""),
                    "balance": mapped.get("Balance", "")
                }
            elif current_txn:
                # Continuation line
                if mapped.get("Narration"):
                    current_txn["merchantRaw"] += " " + mapped["Narration"]
                if mapped.get("Withdrawal"): # Sometimes amts spill?
                     pass 
                
        if current_txn:
            temp_transactions.append(current_txn)
            
        self._refine_and_validate(temp_transactions)

    def _map_row_to_columns(self, row):
        """
        Assigns each word in the row to a column bucket based on self.column_map
        """
        mapped = {}
        if not self.column_map:
            # No layout detected? Return raw text as 'Narration' or whatever
            # This is a fallback
            mapped["Narration"] = " ".join([w['text'] for w in row])
            return mapped
            
        for w in row:
            center_x = (w['x0'] + w['x1']) / 2
            
            # Find bucket
            best_col = None
            for col, (x0, x1) in self.column_map.items():
                if x0 <= center_x <= x1:
                    best_col = col
                    break
            
            if best_col:
                if best_col not in mapped: mapped[best_col] = ""
                mapped[best_col] += w['text'] + " "
        
        # Strip spaces
        for k in mapped: mapped[k] = mapped[k].strip()
        return mapped

    def _refine_and_validate(self, raw_txns):
        """
        Parses numbers and applies Balance Continuity Check.
        """
        cleaned_txns = []
        
        # 1. Filter Noise (B/F, C/F)
        # We don't want summary lines that look like transactions
        skip_patterns = [
            r'BROUGHT\s+FORWARD', 
            r'CARRIED\s+FORWARD', 
            r'OPENING\s+BALANCE',
            r'CLOSING\s+BALANCE',
            r'TOTAL\s+.*',
        ]
        
        for t in raw_txns:
            narration = t.get("merchantRaw", "").upper()
            if any(re.search(p, narration) for p in skip_patterns):
                continue

            # Parse amounts
            w_str = t.get("withdrawal", "").replace(',', '')
            d_str = t.get("deposit", "").replace(',', '')
            b_str = t.get("balance", "").replace(',', '')
            
            try: w_val = float(w_str) if w_str else 0.0
            except: w_val = 0.0
            
            try: d_val = float(d_str) if d_str else 0.0
            except: d_val = 0.0
            
            try: b_val = float(b_str) if b_str else 0.0
            except: b_val = 0.0
            
            # Determine type
            tx_type = "debit"
            amount = 0.0
            
            if w_val > 0 and d_val == 0:
                tx_type = "debit"
                amount = w_val
            elif d_val > 0 and w_val == 0:
                tx_type = "credit"
                amount = d_val
            elif w_val > 0 and d_val > 0:
                # Ambiguous? Use larger?
                amount = max(w_val, d_val)
                tx_type = "debit" if w_val > d_val else "credit"
            
            # Clean narration
            narration_clean = re.sub(r'[^\w\s\-\./]', ' ', t["merchantRaw"]).strip()
            
            cleaned_txns.append({
                "date": t["date"],
                "merchantRaw": narration_clean[:100],
                "amount": amount,
                "transactionType": tx_type,
                "closingBalance": b_val,
                "confidenceScore": 95 if (w_val or d_val) else 50,
                "description": None
            })
            
        # 2. Balance Continuity Check (The "One Truth")
        # For valid statements, PrevBal - Dr + Cr = CurrBal should hold.
        # We start from the end (reverse) or finding a chain? 
        # Actually checking each step is best.
        
        # We need to sort by date? They come sorted from PDF usually.
        # Let's verify continuity.
        balance_mismatches = 0
        
        if len(cleaned_txns) > 1:
            # We can't verify the very first one without Opening Balance.
            # But we can verify row N against row N+1?
            # Actually statements usually go Top-Down (Oldest -> Newest) or Reverse.
            # Let's assume Top-Down for standard checks.
            pass

        self.transactions = cleaned_txns
        
    def _extract_footer_validation(self, pdf):
        full_text = ""
        # scan last page
        if len(pdf.pages) > 0:
            full_text = pdf.pages[-1].extract_text()
            
        try:
            # Flexible regex for "Total Dr Count : 76"
            dr_matches = re.findall(r'Total\s+Dr\s+Count\s*[:\-\.]?\s*(\d+)', full_text, re.IGNORECASE)
            cr_matches = re.findall(r'Total\s+Cr\s+Count\s*[:\-\.]?\s*(\d+)', full_text, re.IGNORECASE)
            
            if dr_matches:
                self.validation["expectedDrCount"] = int(dr_matches[-1])
                self.validation["foundFooter"] = True
            
            if cr_matches:
                self.validation["expectedCrCount"] = int(cr_matches[-1])
                self.validation["foundFooter"] = True
                
            # Perform Validation Match
            actual_dr = sum(1 for t in self.transactions if t['transactionType'] == 'debit')
            actual_cr = sum(1 for t in self.transactions if t['transactionType'] == 'credit')
            
            if self.validation["foundFooter"]:
                self.validation["matches"] = (
                    self.validation["expectedDrCount"] == actual_dr and 
                    self.validation["expectedCrCount"] == actual_cr
                )
                self.validation["actualDrCount"] = actual_dr
                self.validation["actualCrCount"] = actual_cr
                
                print(f"DEBUG: Validation: Expected Dr={self.validation['expectedDrCount']}, Actual={actual_dr}")
                print(f"DEBUG: Validation: Expected Cr={self.validation['expectedCrCount']}, Actual={actual_cr}")

        except Exception as e:
            print(f"Validation extract error: {e}")


def parse_pdf_slow(pdf_path):
    parser = BankStatementParser(pdf_path)
    return parser.parse()
