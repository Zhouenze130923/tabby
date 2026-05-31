import { useState, useEffect } from "react";
import { Play, Package, X, ChevronDown, ChevronRight } from "lucide-react";

interface Skill {
  name: string;
  description: string;
  prompt: string;
}

interface SkillsPanelProps {
  onClose: () => void;
}

export default function SkillsPanel({ onClose }: SkillsPanelProps) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    loadSkills();
  }, []);

  const loadSkills = async () => {
    try {
      const list = await window.tabby.skills.list();
      setSkills(list as Skill[]);
    } catch (err) {
      console.error("Failed to load skills:", err);
    }
  };

  const handleRun = async (skill: Skill) => {
    setRunning(true);
    setResult(null);
    try {
      const output = await window.tabby.skills.run(skill.name);
      setResult(output);
    } catch (err) {
      setResult(`执行失败: ${err}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[520px] max-h-[75vh] bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-gray-200 dark:border-zinc-700 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <Package size={18} className="text-gray-600 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Skills</h2>
            <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
              {skills.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-gray-400"
          >
            <X size={18} />
          </button>
        </div>

        {/* Skills list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {skills.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
              <Package size={32} className="mb-2 opacity-50" />
              <p className="text-sm">暂无可用 Skill</p>
              <p className="text-xs mt-1">将 .yaml 文件放入 skills/ 目录即可加载</p>
            </div>
          ) : (
            skills.map((skill) => (
              <div
                key={skill.name}
                className="rounded-lg border border-gray-200 dark:border-zinc-700 overflow-hidden"
              >
                {/* Skill header */}
                <button
                  onClick={() => setExpanded(expanded === skill.name ? null : skill.name)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  <div className="flex items-center gap-3 text-left">
                    {expanded === skill.name ? (
                      <ChevronDown size={16} className="text-gray-400 shrink-0" />
                    ) : (
                      <ChevronRight size={16} className="text-gray-400 shrink-0" />
                    )}
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {skill.description || skill.name}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {skill.name}.yaml
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRun(skill);
                    }}
                    disabled={running}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg accent-bg text-white text-xs accent-bg-hover\/90 transition-colors disabled:opacity-50"
                  >
                    <Play size={12} />
                    运行
                  </button>
                </button>

                {/* Expanded prompt preview */}
                {expanded === skill.name && (
                  <div className="px-4 pb-3">
                    <pre className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-800 rounded-lg p-3 overflow-x-auto max-h-32 whitespace-pre-wrap font-mono">
                      {skill.prompt}
                    </pre>
                  </div>
                )}
              </div>
            ))
          )}

          {/* Result area */}
          {result !== null && (
            <div className="mt-4 p-3 rounded-lg bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">输出结果</div>
              <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono">
                {result}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 dark:border-zinc-700 text-xs text-gray-400 dark:text-gray-500">
          Skills 存放在 skills/ 目录，支持 YAML 格式
        </div>
      </div>
    </div>
  );
}
