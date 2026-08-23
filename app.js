/* === FULLY CORRECTED QUOTATION IMAGE GENERATOR (5 COLUMNS + DAILY COLUMN FIXED) === */
function doGenerateCustomerImage() {
    let quoteDiv = document.createElement('div'); 
    quoteDiv.style.width = "720px"; // रुंदी 720px केल्यामुळे सर्व ५ कॉलम एकदम व्यवस्थित बसतील
    quoteDiv.style.padding = "20px"; 
    quoteDiv.style.background = "#f8fafc"; 
    quoteDiv.style.position = "absolute"; 
    quoteDiv.style.top = "-9999px"; 
    quoteDiv.style.fontFamily = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

    let c = customerQueue[activeCustomerIndex]; 
    let ltvLimit = c?.ltv || 100;
    
    let salesName = localStorage.getItem('portal_sales_name') || "LAKSHYA"; 
    let salesMobile = localStorage.getItem('portal_sales_mobile') || "8087313624";

    const theme = getDailyTheme();

    let html = ` 
    <div style="background: ${theme.bg}; border-radius: 16px; padding: 20px; color: ${theme.text}; text-align: center; margin-bottom: 25px; box-shadow: 0 10px 25px rgba(0,0,0,0.15);"> 
        <h2 style="margin:0; font-size:28px; font-weight:900; letter-spacing: 1px; display:flex; justify-content:center; align-items:center; gap:10px; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">
            <span>${theme.icon}</span> EXCLUSIVE OFFERS FOR YOU!
        </h2> 
        
        <div style="margin:12px 0; font-size:18px; font-weight:bold; color:#f8fafc; opacity: 0.9;">
            👤 ${salesName} <span style="margin: 0 8px; opacity:0.5;">|</span> 📞 ${salesMobile}
        </div>

        <div style="background: rgba(255,255,255,0.15); padding: 12px 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.3); display: inline-flex; flex-wrap: wrap; gap: 15px; align-items: center; justify-content: center;"> 
            <span style="color:#a7f3d0; font-weight:900; font-size:16px;">LIMIT: ₹${c?.limit || 0}</span> 
            <span style="color:#fde047; font-weight:900; font-size:16px;">LTV: ${ltvLimit}%</span> 
            <span style="background: #fff; color: #333; padding:2px 10px; border-radius:12px; font-size:13px; font-weight:900;">${c?.type || 'NEW'}</span> 
            ${c?.cap ? `<span style="background: #fecaca; color: #991b1b; padding:2px 10px; border-radius:12px; font-size:13px; font-weight:900;">CAP: ₹${c.cap}</span>` : ''} 
        </div> 
    </div>`;

    let hasV = false; 
    let productsToRender = window.tempImageGenIndices.map(idx => current_products[idx]);
    
    productsToRender.forEach((prod) => {
        let validS = prod.calculatedData.filter(d => { 
            let isLtvB = (d.curLTV > ltvLimit); 
            let isBoundB = false; 
            if (prod.isNonTieup && prod.inputs.mrp > 0) { 
                if (d.loan < d.minLoan || d.loan > d.maxLoan) isBoundB = true; 
            } 
            return !isLtvB && !isBoundB && !d.inactive && !d.isInv50Breach && d.loan > 0; 
        });
        
        if(validS.length === 0) return; 
        hasV = true; 
        let invAmt = prod.inputs.inv > 0 ? prod.inputs.inv : prod.inputs.mrp;

        let winDp = [...validS].sort((a,b) => a.dp - b.dp)[0]; 
        let winEmi = [...validS].sort((a,b) => a.emi - b.emi)[0]; 
        let winPop = [...validS].filter(s => s.roi === 0 || s.isFixed).sort((a,b) => a.dp - b.dp)[0] || validS[0]; 
        let winBalance = [...validS].sort((a,b) => (a.dp + (a.emi * 2)) - (b.dp + (b.emi * 2)))[0] || validS[0];
        
        let schemeMap = new Map(); 
        validS.forEach(s => schemeMap.set(s.dIdx, { scheme: s, badges: [] }));

        if (winDp) { let entry = schemeMap.get(winDp.dIdx); entry.badges.push("DP"); }
        if (winEmi && !schemeMap.get(winEmi.dIdx).badges.includes("EMI")) { let entry = schemeMap.get(winEmi.dIdx); entry.badges.push("EMI"); }
        if (winPop && !schemeMap.get(winPop.dIdx).badges.includes("POP")) { let entry = schemeMap.get(winPop.dIdx); entry.badges.push("POP"); }
        if (winBalance && !schemeMap.get(winBalance.dIdx).badges.includes("BAL")) { let entry = schemeMap.get(winBalance.dIdx); entry.badges.push("BAL"); }

        let badgeDetails = {
            "DP": { text: "LOWEST DP", bg: "#dcfce7", color: "#059669" },
            "EMI": { text: "LOWEST EMI", bg: "#dbeafe", color: "#2563eb" },
            "POP": { text: "TOP CHOICE", bg: "#fef3c7", color: "#d97706" },
            "BAL": { text: "BEST VALUE", bg: "#f3e8ff", color: "#7c3aed" }
        };

        let badgedEntries = Array.from(schemeMap.values()).filter(e => e.badges.length > 0);
        badgedEntries.sort((a, b) => b.badges.length - a.badges.length);
        let top4Entries = badgedEntries.slice(0, 4);
        let top4Schemes = top4Entries.map(e => e.scheme).sort((a, b) => a.dp - b.dp);
        let topSchemeIDs = new Set(top4Schemes.map(s => s.dIdx));

        let remainingSchemes = validS.filter(d => !topSchemeIDs.has(d.dIdx)).sort((a, b) => a.dp - b.dp);

        // Top 4 Rows (5 Columns: Scheme, DP, EMI, M, Daily)
        let top4RowsHtml = top4Entries.map((item, i) => {
            let d = item.scheme;
            let bHtml = item.badges.map(b => `
                <span style="background:${badgeDetails[b].bg}; color:${badgeDetails[b].color}; font-size:10px; font-weight:800; padding:2px 8px; border-radius:12px; margin-right:4px; display:inline-block; letter-spacing:0.5px;">
                    ${badgeDetails[b].text}
                </span>
            `).join('');

            return `
                <tr style="background:#ffffff; border-bottom: 1px solid #e2e8f0;">
                    <td style="padding:14px 12px; text-align:left; width: 28%;">
                        <div style="font-size:18px; font-weight:900; color:#0f172a;">${d.currentTenure}/${d.advEmi}</div>
                        <div style="margin-top:5px; display:flex; flex-wrap:wrap; gap:2px;">${bHtml}</div>
                    </td>
                    <td style="padding:14px 6px; color:#059669; font-size:16px; font-weight:900; width: 18%;">₹${Math.round(d.dp).toLocaleString()}</td>
                    <td style="padding:14px 6px; color:#2563eb; font-size:16px; font-weight:900; width: 18%;">₹${Math.round(d.emi).toLocaleString()}</td>
                    <td style="padding:14px 6px; font-size:16px; font-weight:900; color:#475569; width: 14%;">${d.inst}</td>
                    <td style="padding:14px 12px; color:#ea580c; font-size:16px; font-weight:900; text-align:right; width: 22%;">₹${Math.round(d.daily).toLocaleString()}</td>
                </tr>
            `;
        }).join('');

        // Remaining Rows (5 Columns)
        let remainingRowsHtml = "";
        if (remainingSchemes.length > 0) {
            remainingRowsHtml += `
                <tr style="background:#f8fafc; border-bottom: 1px solid #e2e8f0;">
                    <td colspan="5" style="padding:10px; font-size:12px; font-weight:800; color:#64748b; letter-spacing:1px; text-align:center;">
                        — OTHER AVAILABLE SCHEMES —
                    </td>
                </tr>
            `;
            remainingRowsHtml += remainingSchemes.map((d, i) => `
                <tr style="background:${i%2==0?'#ffffff':'#fcfcfc'}; border-bottom: 1px solid #f1f5f9;">
                    <td style="padding:10px 12px; font-size:15px; font-weight:800; color:#334155; text-align:left; width: 28%;">${d.currentTenure}/${d.advEmi}</td>
                    <td style="padding:10px 6px; color:#10b981; font-size:15px; font-weight:800; width: 18%;">₹${Math.round(d.dp).toLocaleString()}</td>
                    <td style="padding:10px 6px; color:#3b82f6; font-size:15px; font-weight:800; width: 18%;">₹${Math.round(d.emi).toLocaleString()}</td>
                    <td style="padding:10px 6px; font-size:15px; font-weight:800; color:#64748b; width: 14%;">${d.inst}</td>
                    <td style="padding:10px 12px; color:#ea580c; font-size:15px; font-weight:800; text-align:right; width: 22%;">₹${Math.round(d.daily).toLocaleString()}</td>
                </tr>
            `).join('');
        }

        // Product Box Container with 5-Column Header (Scheme, DP, EMI, M, Daily)
        html += `
        <div style="margin-bottom:25px; border-radius: 12px; overflow: hidden; background:#ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
            <div style="padding:16px 20px; display:flex; justify-content: space-between; align-items: center; background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
                <div style="display:flex; align-items:center; gap:10px; flex: 1;">
                    <span style="font-size:24px;">📱</span>
                    <h3 style="margin:0; color:#1e293b; font-size:18px; font-weight:900; letter-spacing:0.5px; line-height:1.2;">${prod.name}</h3>
                </div>
                <div style="background: #334155; color: #ffffff; padding: 6px 14px; border-radius: 8px; font-size:15px; font-weight:900; margin-left:10px; white-space:nowrap;">
                    INV: ₹${invAmt.toLocaleString()}
                </div>
            </div>
            <div style="padding: 0;">
                <table style="width:100%; border-collapse:collapse; text-align:center;">
                    <thead style="background:#f8fafc;">
                        <tr style="color:#64748b; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:1px; border-bottom: 2px solid #e2e8f0;">
                            <th style="padding:12px 12px; text-align:left; width: 28%;">SCHEME</th>
                            <th style="padding:12px 6px; width: 18%;">DP</th>
                            <th style="padding:12px 6px; width: 18%;">EMI</th>
                            <th style="padding:12px 6px; width: 14%;">M</th>
                            <th style="padding:12px 12px; text-align:right; width: 22%;">DAILY</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${top4RowsHtml}
                        ${remainingRowsHtml}
                    </tbody>
                </table>
            </div>
        </div>`;
    });

    if(!hasV) { showToast("⚠️ Eligibility ke anusar koi Scheme nahi baith rahi hai!", "error"); return; }

    html += `<div style="text-align:center; margin-top: 10px; color:#94a3b8; font-size: 13px; font-weight: bold; border-top: 1px dashed #cbd5e1; padding-top: 15px;">Generated securely via Persistent Portal</div>`;
    quoteDiv.innerHTML = html; document.body.appendChild(quoteDiv);

    html2canvas(quoteDiv, {scale: 2}).then(canvas => { 
        let imgDataUrl = canvas.toDataURL("image/png"); document.getElementById('generatedImage').src = imgDataUrl; document.getElementById('imageViewerModal').style.display = 'flex'; document.body.removeChild(quoteDiv); 
        if(requestWhatsAppDispatch) {
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            if (isMobile) {
                let a = document.createElement("a"); a.href = imgDataUrl; let safeName = c?.name !== "-" ? c.name.replace(/\s+/g, '_') : "Customer"; a.download = `Quotation_${safeName}.png`; document.body.appendChild(a); a.click(); document.body.removeChild(a); showToast("✅ Image downloaded! WhatsApp opening...", "success");
                setTimeout(() => { let mobile = c?.mobile || ""; if(mobile && mobile.length >= 10) window.open(`https://wa.me/91${mobile}`, '_blank'); }, 500);
            } else {
                document.getElementById('clipboardStatusAlert').style.display = 'none';
                canvas.toBlob(blob => {
                    try { navigator.clipboard.write([ new ClipboardItem({ "image/png": blob }) ]).then(() => { document.getElementById('clipboardStatusAlert').style.display = 'block'; setTimeout(() => { let mobile = c?.mobile || ""; if(mobile && mobile.length >= 10) window.open(`https://wa.me/91${mobile}`, '_blank'); }, 500); }).catch(err => { showCustomAlert("📋 Long Press karke Copy Image karein."); let mobile = c?.mobile || ""; if(mobile && mobile.length >= 10) window.open(`https://wa.me/91${mobile}`, '_blank'); }); } 
                    catch (e) { let mobile = c?.mobile || ""; if(mobile && mobile.length >= 10) window.open(`https://wa.me/91${mobile}`, '_blank'); }
                }, 'image/png');
            }
        } else { document.getElementById('clipboardStatusAlert').style.display = 'none'; }
    });
}
