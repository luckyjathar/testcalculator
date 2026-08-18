import pandas as pd
import os
import re

INPUT_FILE = "Updated Digital Scheme Chart AUG 26.xlsb"
OUTPUT_FILE = "Extracted_Data_Output.csv"

def process_data():
    print(f"Reading file: {INPUT_FILE}...")
    
    try:
        # सर्व शीट्स वाचणे
        all_sheets = pd.read_excel(INPUT_FILE, sheet_name=None, engine='pyxlsb', header=None)
    except Exception as e:
        print(f"Error reading file: {e}")
        return

    final_data = []
    # तुझे मूळ Headers
    headers = ["SHEET NAME", "CATEGORY", "BRAND", "MODEL", "MRP", "TOTAL TENURE", "ADVANCE EMI", "DBD", "CPF", "VALIDITY", "LOCATION"]
    final_data.append(headers)

    for sheet_name, df in all_sheets.items():
        print(f"Processing sheet: {sheet_name}")
        
        # NaN व्हॅल्यूज रिकाम्या स्ट्रिंगमध्ये बदलून लिस्ट बनवणे
        raw_data = df.fillna("").values.tolist()
        if not raw_data:
            continue

        dbd_row_idx = -1
        cpf_row_idx = -1
        validity_row_idx = -1
        location_row_idx = -1
        tenure_row_idx = -1
        category_col_idx = -1
        brand_col_idx = -1
        model_name_col_idx = -1
        mrp_col_idx = -1
        with_mrp_col_idx = -1
        data_start_row = -1

        # 1. डायनॅमिक Row आणि Column शोधणे
        for idx, row in enumerate(raw_data):
            row_strs = [str(c).strip().upper() for c in row]
            
            if "DBD" in row_strs: dbd_row_idx = idx
            if "CPF" in row_strs or "PF" in row_strs: cpf_row_idx = idx
            if "VALIDITY" in row_strs: validity_row_idx = idx
            if "LOCATION" in row_strs: location_row_idx = idx
            
            if idx < 10:
                for c in row_strs:
                    if re.match(r'^\d+\s*[|/]\s*\d+$', c):
                        tenure_row_idx = idx
                        break

            if any(x in row_strs for x in ['CATEGORY', 'OEM NAME', 'BRAND']):
                category_col_idx = next((i for i, x in enumerate(row_strs) if 'CATEGORY' in x), -1)
                brand_col_idx = next((i for i, x in enumerate(row_strs) if 'OEM NAME' in x or 'BRAND' in x or x == 'OEM'), -1)
                model_name_col_idx = next((i for i, x in enumerate(row_strs) if 'MODEL NAME' in x), -1)
                with_mrp_col_idx = next((i for i, x in enumerate(row_strs) if 'WITH MRP' in x or x == 'M_NAME'), -1)
                mrp_col_idx = next((i for i, x in enumerate(row_strs) if x == 'MRP'), -1)
                data_start_row = idx + 1

        # Fallbacks (जर सापडले नाहीत तर)
        if dbd_row_idx == -1: dbd_row_idx = 1
        if cpf_row_idx == -1: cpf_row_idx = 3
        if location_row_idx == -1: location_row_idx = 4
        if validity_row_idx == -1: validity_row_idx = 5
        if tenure_row_idx == -1: tenure_row_idx = 6
        if category_col_idx == -1: category_col_idx = 2
        if brand_col_idx == -1: brand_col_idx = 1
        if model_name_col_idx == -1: model_name_col_idx = 3
        if mrp_col_idx == -1: mrp_col_idx = 7
        if data_start_row == -1: data_start_row = 8

        # 2. डेटा एक्सट्रॅक्ट करणे
        for i in range(data_start_row, len(raw_data)):
            current_row = raw_data[i]
            max_idx = max(category_col_idx, brand_col_idx, model_name_col_idx)
            
            if max_idx < 0 or len(current_row) <= max_idx:
                continue

            category_val = str(current_row[category_col_idx]).strip() if category_col_idx != -1 and category_col_idx < len(current_row) else ""
            brand_val = str(current_row[brand_col_idx]).strip() if brand_col_idx != -1 and brand_col_idx < len(current_row) else ""
            model_name_val = str(current_row[model_name_col_idx]).strip() if model_name_col_idx != -1 and model_name_col_idx < len(current_row) else ""
            mrp_val = str(current_row[mrp_col_idx]).strip() if mrp_col_idx != -1 and mrp_col_idx < len(current_row) else ""

            if not model_name_val:
                continue

            final_model_combined = ""
            if with_mrp_col_idx != -1 and with_mrp_col_idx < len(current_row) and current_row[with_mrp_col_idx]:
                final_model_combined = str(current_row[with_mrp_col_idx]).strip()
                if mrp_val and mrp_val not in final_model_combined:
                    final_model_combined = f"{final_model_combined} {mrp_val}".strip()
            else:
                final_model_combined = f"{model_name_val} {mrp_val}".strip()

            search_start_index = max(category_col_idx, brand_col_idx, model_name_col_idx, mrp_col_idx, with_mrp_col_idx) + 1

            for j in range(search_start_index, len(current_row)):
                cell_value = str(current_row[j]).strip()
                
                # फक्त जिथे काहीतरी Value आहे तीच घेणार
                if cell_value != "":
                    tenure_val_raw = str(raw_data[tenure_row_idx][j]).strip() if tenure_row_idx < len(raw_data) and j < len(raw_data[tenure_row_idx]) else ""
                    total_tenure = ""
                    advance_emi = ""
                    if tenure_val_raw:
                        parts = re.split(r'[|/]', tenure_val_raw)
                        total_tenure = parts[0].strip() if len(parts) > 0 else ""
                        advance_emi = parts[1].strip() if len(parts) > 1 else ""

                    dbd_val_raw = str(raw_data[dbd_row_idx][j]).strip() if dbd_row_idx < len(raw_data) and j < len(raw_data[dbd_row_idx]) else ""
                    final_dbd = dbd_val_raw.replace("%", "").strip()

                    cpf_val = str(raw_data[cpf_row_idx][j]).strip() if cpf_row_idx < len(raw_data) and j < len(raw_data[cpf_row_idx]) else ""
                    validity_val = str(raw_data[validity_row_idx][j]).strip() if validity_row_idx < len(raw_data) and j < len(raw_data[validity_row_idx]) else ""
                    location_val = str(raw_data[location_row_idx][j]).strip() if location_row_idx < len(raw_data) and j < len(raw_data[location_row_idx]) else ""

                    def check_nil(val):
                        return "0" if str(val).upper() == "NIL" else val

                    final_data.append([
                        sheet_name,
                        check_nil(category_val),
                        check_nil(brand_val),
                        check_nil(final_model_combined),
                        check_nil(mrp_val),
                        check_nil(total_tenure),
                        check_nil(advance_emi),
                        check_nil(final_dbd),
                        check_nil(cpf_val),
                        check_nil(validity_val),
                        check_nil(location_val)
                    ])

    # 3. CSV फाईलमध्ये सेव्ह करणे
    out_df = pd.DataFrame(final_data)
    out_df.to_csv(OUTPUT_FILE, index=False, header=False, encoding='utf-8-sig')
    print(f"Success! Data saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    if os.path.exists(INPUT_FILE):
        process_data()
    else:
        print(f"File {INPUT_FILE} not found!")
