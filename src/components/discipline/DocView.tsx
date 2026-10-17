import type { DocModel } from '@/lib/discipline/templates';
import type { SchoolSettings } from '@/lib/discipline/types';

export default function DocView({
  model, settings, docNo, createdAt,
}: { model: DocModel; settings: SchoolSettings; docNo?: string; createdAt?: string }) {
  return (
    <div className="doc-sheet">
      <div className="text-center mb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="w-16 h-16 flex items-center justify-center">
            {settings.ministry_logo_url && <img src={settings.ministry_logo_url} alt="" className="max-h-16" />}
          </div>
          <div className="text-sm font-bold leading-6">
            <p>{settings.country}</p>
            <p>{settings.authority}</p>
            <p>{settings.school_name}</p>
          </div>
          <div className="w-16 h-16 flex items-center justify-center">
            {settings.school_logo_url && <img src={settings.school_logo_url} alt="" className="max-h-16" />}
          </div>
        </div>
        {settings.print_header_note && <p className="text-xs mt-1">{settings.print_header_note}</p>}
        <hr className="my-2 border-gray-800" />
        <h2 className="text-lg font-bold">{model.title}</h2>
        <p className="text-xs mt-1">
          {docNo ? `رقم المستند: ${docNo}` : 'رقم المستند: يُمنح عند الحفظ'}
          {' — '}
          {createdAt ? `تاريخ الإنشاء: ${createdAt}` : ''}
        </p>
        <p className="text-[10px] text-gray-600">
          نموذج داخلي أنشأه برنامج «محمد الفاتح» وليس نموذجًا رسميًا صادرًا عن الوزارة
          {settings.academic_year ? ` — العام الدراسي ${settings.academic_year}` : ''}
          {settings.term ? ` — ${settings.term}` : ''}
        </p>
      </div>

      {model.sections.map((s, i) => (
        <div key={i} className="mb-3">
          {s.heading && <h3 className="font-bold text-sm bg-gray-100 px-2 py-1 border border-gray-400">{s.heading}</h3>}
          {s.rows && (
            <table className="w-full text-sm border-collapse">
              <tbody>
                {s.rows.map(([k, v]) => (
                  <tr key={k}>
                    <td className="border border-gray-400 px-2 py-1 w-40 font-semibold bg-gray-50 align-top">{k}</td>
                    <td className="border border-gray-400 px-2 py-1 whitespace-pre-wrap">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {s.text && <p className="text-sm leading-7 px-1 py-2">{s.text}</p>}
          {s.table && (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>{s.table.head.map((h) => <th key={h} className="border border-gray-400 px-1 py-1 bg-gray-100">{h}</th>)}</tr>
              </thead>
              <tbody>
                {s.table.rows.length === 0 && <tr><td colSpan={s.table.head.length} className="border border-gray-400 p-2 text-center">لا توجد سجلات</td></tr>}
                {s.table.rows.map((r, ri) => (
                  <tr key={ri}>{r.map((c, ci) => <td key={ci} className="border border-gray-400 px-1 py-1 align-top">{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}

      <div className="flex justify-between gap-4 mt-8 text-sm">
        {model.signatures.map((s) => (
          <div key={s} className="flex-1 text-center">
            <p className="font-semibold">{s}</p>
            <p className="mt-6">....................</p>
            <p className="text-xs">التاريخ: ....../....../........</p>
          </div>
        ))}
      </div>
    </div>
  );
}
