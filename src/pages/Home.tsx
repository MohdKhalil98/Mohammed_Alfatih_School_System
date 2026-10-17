import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { PageKey } from '@/lib/nav';
import { formatArabicDate, toDateString } from '@/lib/types';
import { FilePlus2, Users, CheckCircle, AlertCircle, XCircle, BookOpen, TrendingUp } from 'lucide-react';

type HomeProps = {
  onNavigate: (page: PageKey) => void;
};

type ClassStat = {
  class_id: string;
  class_name: string;
  total_students: number;
  present: number;
  excused: number;
  unexcused: number;
  recorded: boolean;
};

export default function Home({ onNavigate }: HomeProps) {
  const [loading, setLoading] = useState(true);
  const [today] = useState(new Date());
  const [totalStudents, setTotalStudents] = useState(0);
  const [, setTotalClasses] = useState(0);
  const [classStats, setClassStats] = useState<ClassStat[]>([]);
  const [todayPresent, setTodayPresent] = useState(0);
  const [todayExcused, setTodayExcused] = useState(0);
  const [todayUnexcused, setTodayUnexcused] = useState(0);
  const [todayRecorded, setTodayRecorded] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const todayStr = toDateString(new Date());

    // تحميل الصفوف
    const { data: classes } = await supabase
      .from('classes')
      .select('id, name, order_index')
      .order('order_index', { ascending: true });

    // تحميل الطلاب
    const { data: students } = await supabase
      .from('students')
      .select('id, class_id');

    // تحميل سجلات اليوم
    const { data: todayAttendance } = await supabase
      .from('attendance')
      .select('id, status, class_id')
      .eq('date', todayStr);

    const totalSt = students?.length || 0;
    const totalCl = classes?.length || 0;
    setTotalStudents(totalSt);
    setTotalClasses(totalCl);

    const present = todayAttendance?.filter((a) => a.status === 'حاضر').length || 0;
    const excused = todayAttendance?.filter((a) => a.status === 'غائب بعذر').length || 0;
    const unexcused = todayAttendance?.filter((a) => a.status === 'غائب بلا عذر').length || 0;

    setTodayPresent(present);
    setTodayExcused(excused);
    setTodayUnexcused(unexcused);
    setTodayRecorded(todayAttendance?.length || 0);

    // إحصائيات لكل صف
    const stats: ClassStat[] = (classes || []).map((cls) => {
      const classStudents = (students || []).filter((s) => s.class_id === cls.id);
      const classAtt = (todayAttendance || []).filter((a) => a.class_id === cls.id);
      return {
        class_id: cls.id,
        class_name: cls.name,
        total_students: classStudents.length,
        present: classAtt.filter((a) => a.status === 'حاضر').length,
        excused: classAtt.filter((a) => a.status === 'غائب بعذر').length,
        unexcused: classAtt.filter((a) => a.status === 'غائب بلا عذر').length,
        recorded: classAtt.length > 0,
      };
    });
    setClassStats(stats);
    setLoading(false);
  }

  const totalToday = todayPresent + todayExcused + todayUnexcused;
  const presentPercent = totalToday > 0 ? Math.round((todayPresent / totalToday) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 fade-in">
      {/* تاريخ اليوم */}
      <div className="bg-gradient-to-l from-[#CE1126] to-[#a00d1f] rounded-xl p-6 text-white mb-6 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="bg-white/20 rounded-xl p-3">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">تاريخ اليوم</h1>
            <p className="text-sm sm:text-lg mt-1">{formatArabicDate(today)}</p>
          </div>
        </div>
      </div>

      {/* أزرار سريعة */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <button
          onClick={() => onNavigate('attendance')}
          className="card hover:border-[#CE1126] transition-all text-center group cursor-pointer"
        >
          <div className="bg-[#CE1126]/10 group-hover:bg-[#CE1126]/20 p-3 rounded-lg w-fit mx-auto mb-2 transition-all">
            <svg className="w-6 h-6 text-[#CE1126]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <p className="font-bold text-gray-700 text-sm">تسجيل الحضور</p>
        </button>

        <button
          onClick={() => onNavigate('students')}
          className="card hover:border-blue-500 transition-all text-center group cursor-pointer"
        >
          <div className="bg-blue-50 group-hover:bg-blue-100 p-3 rounded-lg w-fit mx-auto mb-2 transition-all">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <p className="font-bold text-gray-700 text-sm">إدارة الطلاب</p>
        </button>

        <button
          onClick={() => onNavigate('d-new')}
          className="card hover:border-rose-500 transition-all text-center group cursor-pointer"
        >
          <div className="bg-rose-50 group-hover:bg-rose-100 p-3 rounded-lg w-fit mx-auto mb-2 transition-all">
            <FilePlus2 className="w-6 h-6 text-rose-600" />
          </div>
          <p className="font-bold text-gray-700 text-sm">تسجيل مخالفة</p>
        </button>

        <button
          onClick={() => onNavigate('monthly-report')}
          className="card hover:border-amber-500 transition-all text-center group cursor-pointer"
        >
          <div className="bg-amber-50 group-hover:bg-amber-100 p-3 rounded-lg w-fit mx-auto mb-2 transition-all">
            <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="font-bold text-gray-700 text-sm">التقرير الشهري</p>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">جارٍ تحميل البيانات...</div>
      ) : (
        <>
          {/* البطاقات الإحصائية الرئيسية */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <div className="stat-card border-r-4 border-r-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-500 font-semibold">إجمالي الطلاب</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-800 mt-1">{totalStudents}</p>
                </div>
                <div className="bg-blue-100 p-2.5 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="stat-card border-r-4 border-r-emerald-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-500 font-semibold">حاضر اليوم</p>
                  <p className="text-2xl sm:text-3xl font-bold text-emerald-600 mt-1">{todayPresent}</p>
                </div>
                <div className="bg-emerald-100 p-2.5 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </div>

            <div className="stat-card border-r-4 border-r-amber-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-500 font-semibold">غائب بعذر</p>
                  <p className="text-2xl sm:text-3xl font-bold text-amber-600 mt-1">{todayExcused}</p>
                </div>
                <div className="bg-amber-100 p-2.5 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </div>

            <div className="stat-card border-r-4 border-r-red-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-500 font-semibold">غائب بلا عذر</p>
                  <p className="text-2xl sm:text-3xl font-bold text-red-600 mt-1">{todayUnexcused}</p>
                </div>
                <div className="bg-red-100 p-2.5 rounded-lg">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>
          </div>

          {/* نسبة الحضور */}
          {totalToday > 0 && (
            <div className="card mb-6">
              <div className="flex items-center gap-3 mb-3">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                <h2 className="font-bold text-gray-800">نسبة الحضور اليوم</h2>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
                <div
                  className="bg-gradient-to-l from-emerald-500 to-emerald-600 h-full rounded-full flex items-center justify-center text-white text-xs font-bold transition-all duration-500"
                  style={{ width: `${presentPercent}%` }}
                >
                  {presentPercent}% حضور
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                تم تسجيل {todayRecorded} طالب من أصل {totalStudents} طالب
              </p>
            </div>
          )}

          {/* إحصائيات الصفوف */}
          <div className="card mb-6">
            <div className="flex items-center gap-3 mb-4">
              <BookOpen className="w-5 h-5 text-[#CE1126]" />
              <h2 className="font-bold text-gray-800">إحصائيات الصفوف لليوم</h2>
            </div>

            {classStats.length === 0 ? (
              <p className="text-gray-500 text-center py-6">لا توجد صفوف مضافة بعد</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-600">
                      <th className="text-right py-2 px-3 font-semibold">الصف</th>
                      <th className="text-center py-2 px-3 font-semibold">عدد الطلاب</th>
                      <th className="text-center py-2 px-3 font-semibold">حاضر</th>
                      <th className="text-center py-2 px-3 font-semibold">غائب بعذر</th>
                      <th className="text-center py-2 px-3 font-semibold">غائب بلا عذر</th>
                      <th className="text-center py-2 px-3 font-semibold">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classStats.map((stat) => (
                      <tr key={stat.class_id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-gray-800">{stat.class_name}</td>
                        <td className="text-center py-2.5 px-3 text-gray-600">{stat.total_students}</td>
                        <td className="text-center py-2.5 px-3">
                          <span className="text-emerald-600 font-bold">{stat.present}</span>
                        </td>
                        <td className="text-center py-2.5 px-3">
                          <span className="text-amber-600 font-bold">{stat.excused}</span>
                        </td>
                        <td className="text-center py-2.5 px-3">
                          <span className="text-red-600 font-bold">{stat.unexcused}</span>
                        </td>
                        <td className="text-center py-2.5 px-3">
                          {stat.recorded ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-semibold border border-emerald-200">
                              <CheckCircle className="w-3 h-3" />
                              تم التسجيل
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full text-xs font-semibold border border-gray-200">
                              لم يسجل
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </>
      )}
    </div>
  );
}
