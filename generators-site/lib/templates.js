export const DOC_STYLES = `
  *{box-sizing:border-box;}
  body{margin:0;background:#fff;}
  .doc{background:#fff;color:#111;font-family:'Cairo',sans-serif;font-weight:700;padding:34px 48px;width:1300px;}
  .doc .doc-header{text-align:center;border-bottom:2px solid #333;padding:10px 0 24px;margin-bottom:24px;position:relative;min-height:125px;}
  .doc .doc-header .logo{position:absolute;top:0;right:0;height:95px;}
  .doc .doc-header .logo-left{position:absolute;top:0;left:0;height:95px;}
  .doc .doc-header .org{font-size:24px;color:#444;}
  .doc .doc-header .org-en{font-size:20px;color:#666;}
  .doc .doc-header h2{font-size:40px;margin:16px 0 0;}
  .doc .doc-footer{margin-top:18px;padding-top:12px;border-top:1px solid #999;font-size:25px;color:#333;text-align:left;font-weight:600;}
  .doc table{width:100%;border-collapse:collapse;margin-bottom:10px;}
  .doc td, .doc th{border:1px solid #333;padding:24px 26px;font-size:30px;vertical-align:top;}
  .doc th{background:#DCE8D0;font-weight:700;text-align:center;width:33%;}
  .doc td.val{font-family:'IBM Plex Mono',monospace;font-size:34px;min-height:26px;text-align:center;vertical-align:middle;}
  .doc .blk-blue th{background:#D6E4F0;}
  .doc .blk-orange th{background:#FBE0C4;}
  .doc .blk-yellow th{background:#FBF0D9;}
  .doc .blk-pink th{background:#F7DADD;}
  .doc .box-label{font-weight:700;font-size:30px;margin:16px 0 8px;}
  .doc .box{border:1px solid #333;min-height:175px;padding:22px 26px;font-size:45px;white-space:pre-wrap;}
  .doc .daily-table th, .doc .daily-table td{padding:14px 8px;font-size:18px;text-align:center;width:auto;}
  .doc .daily-table.summary-faults th{background:#D6E4F0;}
  .doc .daily-table.summary-meters th{background:#FBE0C4;}
  .doc .daily-table.summary-complaints th{background:#FBF0D9;}
  .doc .daily-table th.period-col, .doc .daily-table td.period-col{width:16%;text-align:right;font-size:19px;}
  .doc .daily-table th.num-col, .doc .daily-table td.num-col{width:3%;font-weight:800;}
  .doc .daily-table tr.total-row th, .doc .daily-table tr.total-row td{background:#EFEFEF;font-weight:700;}
  .doc .grand-total{text-align:left;font-size:12px;font-weight:700;margin:6px 0 14px;}
`;
