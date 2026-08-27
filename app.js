function renderRows(pIdx) {
    let prod = current_products[pIdx]; 
    if(!sortConfigs[pIdx]) sortConfigs[pIdx] = {key: 'dp', dir: 'asc'}; 
    let conf = sortConfigs[pIdx]; 
    prod.calculatedData.sort((a,b) => conf.dir==='asc' ? a[conf.key]-b[conf.key] : b[conf.key]-a[conf.key]); 
    let ltvLimit = customerQueue[activeCustomerIndex]?.ltv || 100; 
    let isNT = prod.isNonTieup;

    let today = new Date(); today.setHours(0,0,0,0);

    document.getElementById(`body_${pIdx}`).innerHTML = prod.calculatedData.map(d => {
        if(d.expiryDateStr) {
            let p = d.expiryDateStr.trim().split('/');
            if(p.length === 3) {
                let expD = new Date(p[2], p[1]-1, p[0]);
                if(expD < today) return ''; 
            }
        }

        let curLTV = d.curLTV; let isLtvB = (curLTV > ltvLimit); let isBoundB = false; if (isNT && prod.inputs.mrp > 0) { if (d.loan < d.minLoan || d.loan > d.maxLoan) isBoundB = true; } let isInactive = d.inactive; 

        if (d.isInv50Breach) { isBoundB = true; }

        let rowClass = (d.isFixed ? "fixed-row " : "") + (isLtvB || isBoundB ? "ltv-breach " : "") + (d.isExpired && !isInactive ? "expired-row " : "") + (isInactive ? "inactive-row " : "");
        
        // Action Button Dropdown (Size reduced for mobile)
        let actionMenuBtnHtml = `
        <div style="position:relative; display:inline-block;">
            <button onclick="toggleActionMenu(${pIdx}, ${d.dIdx}, event)" style="background:var(--primary); color:white; border:none; padding:4px 6px; border-radius:4px; font-weight:bold; cursor:pointer; font-size: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.2); min-width: 40px; letter-spacing:0;">ACT▼</button>
            
            <div id="actMenu_${pIdx}_${d.dIdx}" class="act-menu-dropdown" style="display:none; position:absolute; right:0; top:100%; background:white; border:1px solid #e2e8f0; box-shadow:0 10px 25px rgba(0,0,0,0.15); border-radius:8px; z-index:9999; min-width:120px; flex-direction:column; overflow:hidden; margin-top:5px;">
                <button onclick="copySchemeText(${pIdx}, ${d.dIdx}, this); document.getElementById('actMenu_${pIdx}_${d.dIdx}').style.display='none';" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#fff'" style="background:#fff; border:none; padding:10px 12px; text-align:left; cursor:pointer; width:100%; border-bottom:1px solid #f1f5f9; font-size:11px; font-weight:bold; color:var(--dark); transition:0.2s;">📋 COPY</button>
                <button onclick="openEditSchemeModal(${pIdx}, ${d.dIdx}); document.getElementById('actMenu_${pIdx}_${d.dIdx}').style.display='none';" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#fff'" style="background:#fff; border:none; padding:10px 12px; text-align:left; cursor:pointer; width:100%; border-bottom:1px solid #f1f5f9; font-size:11px; font-weight:bold; color:#d97706; transition:0.2s;">✏️ EDIT</button>
                <button onclick="toggleInactive(${pIdx}, ${d.dIdx}); document.getElementById('actMenu_${pIdx}_${d.dIdx}').style.display='none';" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#fff'" style="background:#fff; border:none; padding:10px 12px; text-align:left; cursor:pointer; width:100%; font-size:11px; font-weight:bold; color:${isInactive ? '#059669' : '#dc2626'}; transition:0.2s;">${isInactive ? '✅ ADD' : '🚫 DISABLE'}</button>
            </div>
        </div>`;
        
        let expInfo = d.expiryDateStr ? `<div style="font-size:9px; color:#555; margin-top:2px; font-weight:bold;">Exp: ${d.expiryDateStr}</div>` : ''; let expiredWarning = d.isExpired ? `<div style="color:#d35400; font-size:8px; font-weight:900; margin-top:3px; line-height:1.2; background:#ffeaa7; padding:2px; border-radius:3px;">⚠️ EXPIRED</div>` : '';
        
        return `<tr id="row_${pIdx}_${d.dIdx}" class="${rowClass}">
            <td class="hidden-col">${d.category}</td><td class="hidden-col">${+parseFloat(d.dbd).toFixed(3)}%<br><span style="color:var(--danger); font-weight:900;">₹${Math.round(d.dbdAmt||0).toLocaleString()}</span></td><td class="hidden-col">₹${d.pf}</td><td class="hidden-col">${+parseFloat(d.roi).toFixed(2)}%<br><span style="color:var(--danger); font-weight:900;">₹${Math.round(d.roiAmt||0).toLocaleString()}</span></td><td class="hidden-col">${d.fixedEmi > 0 ? '₹'+d.fixedEmi : 'N/A'}</td><td class="hidden-col" id="ltv_${pIdx}_${d.dIdx}">${Math.round(d.curLTV)}%</td><td class="hidden-col" id="nd_${pIdx}_${d.dIdx}" style="font-weight:900; color:var(--bajaj-blue);">₹${Math.round(d.netDisb).toLocaleString()}</td><td class="hidden-col" id="extra_${pIdx}_${d.dIdx}" style="font-weight:900; color:var(--danger);">₹${Math.round(d.extra).toLocaleString()}</td>
            ${isNT ? `<td class="bound-col" style="padding:4px 1px; font-size:11px; white-space:nowrap;">${d.minLoan > 0 ? '₹' + d.minLoan : '0'}</td><td class="bound-col" style="padding:4px 1px; font-size:11px; white-space:nowrap;">${d.maxLoan < 9999999 ? '₹' + d.maxLoan : 'NO'}</td>` : `<td style="padding:4px 1px; color:#777; font-size:11px; white-space:nowrap;">₹${Math.floor(d.nbfcMaxL)}</td>`}
            
            <!-- Loan Column Full Visibility Fix (Width and font updated) -->
            <td style="padding:4px 2px; text-align:center; vertical-align:middle; white-space:nowrap;" title="Click to Edit Loan Amount">
                <div style="display:inline-flex; justify-content:center; align-items:center;">
                    <span style="color:var(--primary); font-weight:900; font-size:13px;">₹</span>
                    <input id="l_${pIdx}_${d.dIdx}" type="number" value="${Math.floor(d.loan)}" onchange="manual(${pIdx},${d.dIdx})" onblur="manual(${pIdx},${d.dIdx})" style="width: 65px; padding: 0; margin: 0 0 0 2px; border: none; background: transparent; outline: none; box-shadow: none; -webkit-appearance: none; -moz-appearance: textfield; appearance: none; text-align: left; font-weight: 900; font-size: 13px; color: var(--primary); cursor: pointer;">
                </div>
            </td>

            <td id="ta_${pIdx}_${d.dIdx}" style="padding:4px 1px; font-weight:900; font-size:11px; white-space:nowrap;">${d.currentTenure}/${d.advEmi}${expInfo}${expiredWarning}</td>
            <td id="dp_${pIdx}_${d.dIdx}" style="padding:4px 1px; color:var(--success); font-weight:950; font-size:11px; white-space:nowrap;">₹${Math.round(d.dp).toLocaleString()}</td>
            <td id="emi_${pIdx}_${d.dIdx}" style="padding:4px 1px; color:var(--primary); font-weight:950; font-size:11px; white-space:nowrap;">₹${Math.round(d.emi).toLocaleString()}</td>
            <td id="inst_${pIdx}_${d.dIdx}" style="padding:4px 1px; font-weight:900; font-size:11px; white-space:nowrap;">${d.inst}</td>
            <td id="day_${pIdx}_${d.dIdx}" style="padding:4px 1px; color:var(--success); font-weight:950; font-size:11px; white-space:nowrap;">₹${Math.round(d.daily).toLocaleString()}</td>
            <td style="padding:4px 1px; text-align: center; white-space:nowrap;">${actionMenuBtnHtml}</td>
        </tr>`;
    }).join('');
}
