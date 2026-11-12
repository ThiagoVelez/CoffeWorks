// Iconos pequeños de figuras, conexiones y tipos de diagrama.

import React from "react";
import type { DiagramKind, EdgeKind, ShapeType } from "../types";

const S = "#33475b";

export const ShapeIcon: React.FC<{ type: ShapeType; size?: number }> = ({ type, size = 22 }) => {
  const body = (() => {
    switch (type) {
      case "class":
      case "interface":
      case "enum":
      case "object":
      case "entity":
        return (
          <>
            <rect x={3} y={3} width={16} height={16} rx={1.5} fill={type === "entity" ? "#ffffff" : "#fffdf3"} stroke={S} />
            <rect x={3} y={3} width={16} height={5} fill={type === "entity" ? "#2e6b58" : type === "interface" ? "#e3f3e8" : type === "enum" ? "#efe5fb" : "#fdf3d0"} stroke={S} />
            <line x1={3} x2={19} y1={13} y2={13} stroke={S} />
          </>
        );
      case "package":
        return <path d="M3 5 H10 V8 H19 V18 H3 Z" fill="#f6f8fb" stroke={S} />;
      case "note":
        return <path d="M4 3 H15 L18 6 V19 H4 Z" fill="#fff8c4" stroke="#b8a24a" />;
      case "text":
        return (
          <text x={11} y={15} fontSize={12} fontWeight={700} textAnchor="middle" fill={S}>
            T
          </text>
        );
      case "actor":
      case "actorLifeline":
        return (
          <g stroke={S} fill="none" strokeWidth={1.3}>
            <circle cx={11} cy={5} r={3} />
            <path d="M11 8 V14 M6 10 H16 M11 14 L7 19 M11 14 L15 19" />
          </g>
        );
      case "usecase":
      case "erAttribute":
        return <ellipse cx={11} cy={11} rx={9} ry={5.5} fill="#f2f7ff" stroke={S} />;
      case "system":
      case "swimlane":
        return (
          <>
            <rect x={3} y={3} width={16} height={16} fill="#fbfcfe" stroke={S} />
            <line x1={3} x2={19} y1={7} y2={7} stroke={S} />
          </>
        );
      case "lifeline":
        return (
          <>
            <rect x={5} y={2} width={12} height={6} fill="#f2f7ff" stroke={S} />
            <line x1={11} x2={11} y1={8} y2={20} stroke={S} strokeDasharray="2 2" />
          </>
        );
      case "activation":
        return <rect x={9} y={3} width={4} height={16} fill="#e6eefb" stroke={S} />;
      case "fragment":
        return (
          <>
            <rect x={2} y={4} width={18} height={14} fill="none" stroke={S} />
            <path d="M2 4 H9 V7 L7 9 H2" fill="#e3f1ec" stroke={S} />
          </>
        );
      case "initial":
        return <circle cx={11} cy={11} r={6} fill="#1e2a38" />;
      case "final":
        return (
          <>
            <circle cx={11} cy={11} r={7} fill="#fff" stroke="#1e2a38" strokeWidth={1.5} />
            <circle cx={11} cy={11} r={4} fill="#1e2a38" />
          </>
        );
      case "flowFinal":
        return (
          <>
            <circle cx={11} cy={11} r={7} fill="#fff" stroke={S} />
            <path d="M7 7 L15 15 M15 7 L7 15" stroke={S} />
          </>
        );
      case "action":
      case "state":
      case "subtopic":
        return <rect x={2} y={6} width={18} height={11} rx={4} fill={type === "state" ? "#f1f8f4" : "#eef5ff"} stroke={S} />;
      case "decision":
      case "choice":
      case "erRelationship":
        return <path d="M11 3 L19 11 L11 19 L3 11 Z" fill="#fff7e6" stroke={S} />;
      case "fork":
        return <rect x={3} y={9} width={16} height={4} fill="#1e2a38" />;
      case "objectNode":
      case "process":
      case "erEntity":
        return <rect x={2} y={6} width={18} height={11} fill="#eef5ff" stroke={S} />;
      case "erWeakEntity":
        return (
          <>
            <rect x={2} y={5} width={18} height={12} fill="#f2f7ff" stroke={S} />
            <rect x={4} y={7} width={14} height={8} fill="none" stroke={S} />
          </>
        );
      case "sendSignal":
        return <path d="M2 6 H15 L20 11 L15 16 H2 Z" fill="#eef5ff" stroke={S} />;
      case "receiveSignal":
        return <path d="M2 6 H20 V16 H2 L7 11 Z" fill="#eef5ff" stroke={S} />;
      case "history":
        return (
          <>
            <circle cx={11} cy={11} r={7} fill="#fff" stroke={S} />
            <text x={11} y={14.5} fontSize={9} fontWeight={700} textAnchor="middle" fill={S}>
              H
            </text>
          </>
        );
      case "component":
        return (
          <>
            <rect x={3} y={4} width={16} height={14} fill="#f2f7ff" stroke={S} />
            <rect x={13} y={6} width={4} height={5} fill="#fff" stroke={S} />
          </>
        );
      case "providedInterface":
        return (
          <>
            <circle cx={11} cy={8} r={5} fill="#fff" stroke={S} />
            <line x1={11} x2={11} y1={13} y2={20} stroke={S} />
          </>
        );
      case "node":
      case "device":
        return <path d="M3 8 L7 4 H19 V15 L15 19 H3 Z M3 8 H15 V19 M15 8 L19 4" fill="#ecf5f1" stroke={S} />;
      case "artifact":
      case "document":
        return <path d="M5 3 H14 L18 7 V19 H5 Z M14 3 V7 H18" fill="#fff" stroke={S} />;
      case "terminator":
      case "topic":
        return <rect x={2} y={6} width={18} height={11} rx={5.5} fill={type === "topic" ? "#ffd54f" : "#e8f5e9"} stroke={S} />;
      case "io":
        return <path d="M6 6 H20 L16 16 H2 Z" fill="#f3eefe" stroke={S} />;
      case "database":
        return (
          <>
            <path d="M4 6 V16 A7 3 0 0 0 18 16 V6" fill="#fff3e0" stroke={S} />
            <ellipse cx={11} cy={6} rx={7} ry={3} fill="#fff3e0" stroke={S} />
          </>
        );
      case "subprocess":
        return (
          <>
            <rect x={2} y={6} width={18} height={11} fill="#eef5ff" stroke={S} />
            <path d="M5 6 V17 M17 6 V17" stroke={S} />
          </>
        );
      case "connector":
        return <circle cx={11} cy={11} r={6} fill="#fff" stroke={S} />;
    }
    return <rect x={3} y={3} width={16} height={16} fill="#fff" stroke={S} />;
  })();
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" className="shrink-0">
      {body}
    </svg>
  );
};

export const EdgeIcon: React.FC<{ kind: EdgeKind }> = ({ kind }) => {
  const dashed = ["realization", "dependency", "include", "extend", "reply", "anchor", "createMessage"].includes(kind);
  const end = (() => {
    switch (kind) {
      case "generalization":
      case "realization":
        return <path d="M24 7 L18 3 V11 Z" fill="#fff" stroke={S} />;
      case "aggregation":
      case "composition":
        return <path d="M2 7 L6 4 L10 7 L6 10 Z" fill={kind === "composition" ? S : "#fff"} stroke={S} />;
      case "message":
      case "flow":
        return <path d="M24 7 L18 4 V10 Z" fill={S} />;
      case "erRelation":
        return <path d="M18 7 L24 3 M18 7 L24 11 M18 7 H24 M6 3 V11" stroke={S} fill="none" />;
      case "association":
      case "link":
      case "line":
      case "anchor":
        return null;
      default:
        return <path d="M19 3 L24 7 L19 11" stroke={S} fill="none" />;
    }
  })();
  return (
    <svg width={26} height={14} viewBox="0 0 26 14" className="shrink-0">
      <line x1={2} y1={7} x2={23} y2={7} stroke={S} strokeWidth={1.3} strokeDasharray={dashed ? "3 2" : undefined} />
      {end}
    </svg>
  );
};

export const KindIcon: React.FC<{ kind: DiagramKind; size?: number }> = ({ kind, size = 16 }) => {
  const map: Record<DiagramKind, ShapeType> = {
    class: "class",
    object: "object",
    package: "package",
    usecase: "actor",
    sequence: "lifeline",
    activity: "action",
    state: "state",
    component: "component",
    deployment: "node",
    er: "entity",
    flowchart: "decision",
    mindmap: "topic",
  };
  return <ShapeIcon type={map[kind]} size={size} />;
};
