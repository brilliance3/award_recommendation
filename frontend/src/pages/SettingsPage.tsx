import { useEffect, useRef, useState } from "react";
import {
  getSettings,
  updateSettings,
  resetAllSettings,
  uploadInvestigatorSeal,
  listLegislators,
  createLegislator,
  updateLegislator,
  deleteLegislator,
  uploadLegislatorSeal,
  sealUrl,
} from "../api";
import type { AppSetting, Legislator } from "../api/settings";
import { absoluteUrl } from "../api/client";
import Field, { Input, Button } from "../components/Field";

export default function SettingsPage() {
  const [setting, setSetting] = useState<AppSetting | null>(null);
  const [legislators, setLegislators] = useState<Legislator[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSetting, setSavingSetting] = useState(false);
  const [bust, setBust] = useState(Date.now()); // 도장 이미지 캐시 무력화

  const load = async () => {
    setLoading(true);
    try {
      const [s, ls] = await Promise.all([getSettings(), listLegislators()]);
      setSetting(s);
      setLegislators(ls);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading || !setting)
    return <div className="text-ink-500">불러오는 중...</div>;

  const onSettingField = (k: keyof AppSetting, v: string | number) =>
    setSetting(s => (s ? { ...s, [k]: v } : s));

  const onSaveSetting = async () => {
    setSavingSetting(true);
    try {
      const updated = await updateSettings(setting);
      setSetting(updated);
      // 헤더·푸터 부서명 등 전역 표시를 즉시 갱신
      window.dispatchEvent(new Event("settings-updated"));
      alert("설정을 저장했습니다.");
    } catch (e: any) {
      alert("저장 실패: " + (e?.response?.data?.detail || e?.message || ""));
    } finally {
      setSavingSetting(false);
    }
  };

  const onResetAll = async () => {
    if (
      !confirm(
        "⚠️ 모든 설정을 초기화합니다.\n\n표창건 전부(휴지통 포함) · 의원 명단 · 도장 · 설정값이 완전 기본 상태로 되돌아갑니다.\n이 작업은 되돌릴 수 없습니다. 계속할까요?"
      )
    )
      return;
    if (!confirm("정말 초기화할까요? 모든 데이터가 영구 삭제됩니다.")) return;
    try {
      await resetAllSettings();
      window.dispatchEvent(new Event("settings-updated"));
      alert("완전 기본 상태로 초기화되었습니다.");
      window.location.reload();
    } catch (e: any) {
      alert("저장 실패: " + (e?.response?.data?.detail || e?.message || ""));
    } finally {
      setSavingSetting(false);
    }
  };

  const onInvestigatorSeal = async (file: File) => {
    try {
      const updated = await uploadInvestigatorSeal(file);
      setSetting(updated);
      setBust(Date.now());
    } catch (e: any) {
      alert("도장 업로드 실패: " + (e?.response?.data?.detail || e?.message || ""));
    }
  };

  // ---- 의원 ----
  const onLegField = (id: string, patch: Partial<Legislator>) =>
    setLegislators(ls => ls.map(l => (l.id === id ? { ...l, ...patch } : l)));

  const onLegSave = async (l: Legislator) => {
    try {
      await updateLegislator(l.id, {
        name: l.name,
        party: l.party,
        is_chair: l.is_chair,
        staff: l.staff,
      });
    } catch (e: any) {
      alert("의원 저장 실패: " + (e?.response?.data?.detail || e?.message || ""));
    }
  };

  const onLegAdd = async () => {
    const created = await createLegislator({ name: "새 의원", party: "" });
    setLegislators(ls => [...ls, created]);
  };

  const onLegDelete = async (l: Legislator) => {
    if (!confirm(`'${l.name}' 의원을 명단에서 제거할까요? (기존 표창 건은 유지됩니다)`))
      return;
    await deleteLegislator(l.id);
    setLegislators(ls => ls.filter(x => x.id !== l.id));
  };

  const onLegSeal = async (id: string, file: File) => {
    try {
      const updated = await uploadLegislatorSeal(id, file);
      onLegField(id, { seal_filename: updated.seal_filename });
      setBust(Date.now());
    } catch (e: any) {
      alert("도장 업로드 실패: " + (e?.response?.data?.detail || e?.message || ""));
    }
  };

  return (
    <div className="space-y-6">
      <div className="krds-page-header">
        <div>
          <h1 className="krds-page-title">설정</h1>
          <p className="krds-page-sub">
            기관·위원회·조사자 정보와 의원 명단·도장을 관리합니다. 다른 부서나 다음
            회기에서도 이 화면에서 값만 바꿔 사용할 수 있습니다.
          </p>
        </div>
      </div>

      {/* A. 기관/부서 설정 */}
      <section className="krds-card krds-card-pad space-y-4">
        <h2 className="krds-section-title">기관·위원회</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="기관명">
            <Input
              value={setting.agency_name || ""}
              onChange={e => onSettingField("agency_name", e.target.value)}
            />
          </Field>
          <Field label="위원회명">
            <Input
              value={setting.committee_name || ""}
              onChange={e => onSettingField("committee_name", e.target.value)}
            />
          </Field>
          <Field label="부서명(전문위원실)" hint="헤더·푸터에 표시됩니다. 다른 부서가 사용할 때 변경하세요.">
            <Input
              value={setting.department_name || ""}
              onChange={e => onSettingField("department_name", e.target.value)}
            />
          </Field>
          <Field label="표창 등급(award grade)">
            <Input
              value={setting.award_grade || ""}
              onChange={e => onSettingField("award_grade", e.target.value)}
            />
          </Field>
          <Field label="추천자 직위">
            <Input
              value={setting.recommender_position || ""}
              onChange={e => onSettingField("recommender_position", e.target.value)}
            />
          </Field>
          <Field label="의원당 쿼터(명)">
            <Input
              type="number"
              value={setting.quota_per_legislator ?? 100}
              onChange={e =>
                onSettingField("quota_per_legislator", Number(e.target.value) || 0)
              }
            />
          </Field>
          <Field label="경기도지사 표창 등급">
            <Input
              value={setting.governor_award_grade || ""}
              onChange={e => onSettingField("governor_award_grade", e.target.value)}
            />
          </Field>
          <Field label="도지사 쿼터(의원당/역년)" hint="위원장 포함 동일 한도">
            <Input
              type="number"
              value={setting.governor_quota_per_year ?? 1}
              onChange={e =>
                onSettingField("governor_quota_per_year", Number(e.target.value) || 0)
              }
            />
          </Field>
        </div>

        <h2 className="krds-section-title pt-2">현지조사자</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="소속">
            <Input
              value={setting.investigator_department || ""}
              onChange={e =>
                onSettingField("investigator_department", e.target.value)
              }
            />
          </Field>
          <Field label="직위">
            <Input
              value={setting.investigator_position || ""}
              onChange={e => onSettingField("investigator_position", e.target.value)}
            />
          </Field>
          <Field label="직급">
            <Input
              value={setting.investigator_rank || ""}
              onChange={e => onSettingField("investigator_rank", e.target.value)}
            />
          </Field>
          <Field label="성명">
            <Input
              value={setting.investigator_name || ""}
              onChange={e => onSettingField("investigator_name", e.target.value)}
            />
          </Field>
        </div>
        <div className="flex items-center gap-3">
          <SealThumb filename={setting.investigator_seal_filename} bust={bust} />
          <SealUploadButton
            label="조사자 도장 업로드"
            onFile={onInvestigatorSeal}
          />
        </div>

        <div className="flex justify-end pt-2 border-t border-ink-100">
          <Button onClick={onSaveSetting} disabled={savingSetting}>
            설정 저장
          </Button>
        </div>
      </section>

      {/* C. 의원 명단 */}
      <section className="krds-card krds-card-pad space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="krds-section-title">의원 명단</h2>
          <Button size="sm" variant="secondary" onClick={onLegAdd}>
            ＋ 의원 추가
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="krds-table">
            <thead>
              <tr>
                <th className="w-16 text-center">도장</th>
                <th>성명</th>
                <th>정당</th>
                <th className="text-center">위원장</th>
                <th>담당자</th>
                <th className="text-right">조치</th>
              </tr>
            </thead>
            <tbody>
              {legislators.map(l => (
                <tr key={l.id}>
                  <td className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <SealThumb filename={l.seal_filename} bust={bust} small />
                      <SealUploadButton
                        label="변경"
                        small
                        onFile={f => onLegSeal(l.id, f)}
                      />
                    </div>
                  </td>
                  <td>
                    <Input
                      value={l.name}
                      onChange={e => onLegField(l.id, { name: e.target.value })}
                      onBlur={() => onLegSave(l)}
                    />
                  </td>
                  <td>
                    <Input
                      value={l.party || ""}
                      onChange={e => onLegField(l.id, { party: e.target.value })}
                      onBlur={() => onLegSave(l)}
                    />
                  </td>
                  <td className="text-center">
                    <input
                      type="checkbox"
                      checked={l.is_chair}
                      onChange={e => {
                        onLegField(l.id, { is_chair: e.target.checked });
                        onLegSave({ ...l, is_chair: e.target.checked });
                      }}
                    />
                  </td>
                  <td>
                    <Input
                      value={l.staff || ""}
                      onChange={e => onLegField(l.id, { staff: e.target.value })}
                      onBlur={() => onLegSave(l)}
                    />
                  </td>
                  <td className="text-right">
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => onLegDelete(l)}
                    >
                      삭제
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-ink-500">
          성명·정당·담당자는 입력 후 칸을 벗어나면 자동 저장됩니다. 위원장은 쿼터
          무제한으로 계산됩니다.
        </p>
      </section>

      <section className="rounded-lg border border-danger-200 bg-danger-50/40 p-4">
        <h2 className="text-sm font-bold text-danger-700">모든 설정 초기화</h2>
        <p className="text-xs text-ink-600 mt-1">
          표창건 전부(휴지통 포함) · 의원 명단 · 도장 · 설정값을 완전 기본 상태로
          되돌립니다. 다른 부서에 시스템을 넘기기 전 우리 부서 자료를 모두 제거할 때
          사용하세요. <strong>이 작업은 되돌릴 수 없습니다.</strong>
        </p>
        <div className="mt-3">
          <Button variant="danger" onClick={onResetAll}>
            모든 설정 초기화
          </Button>
        </div>
      </section>
    </div>
  );
}

function SealThumb({
  filename,
  bust,
  small,
}: {
  filename?: string | null;
  bust: number;
  small?: boolean;
}) {
  const url = sealUrl(filename, bust);
  const size = small ? "h-9 w-9" : "h-16 w-16";
  if (!url)
    return (
      <div
        className={`${size} rounded border border-dashed border-ink-300 flex items-center justify-center text-[10px] text-ink-400`}
      >
        없음
      </div>
    );
  return (
    <img
      src={absoluteUrl(url)}
      alt="도장"
      className={`${size} object-contain border border-ink-200 rounded bg-white`}
    />
  );
}

function SealUploadButton({
  label,
  onFile,
  small,
}: {
  label: string;
  onFile: (file: File) => void;
  small?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <Button
        size="sm"
        variant="secondary"
        onClick={() => ref.current?.click()}
        className={small ? "text-[11px] px-2 py-0.5" : ""}
      >
        {label}
      </Button>
    </>
  );
}
