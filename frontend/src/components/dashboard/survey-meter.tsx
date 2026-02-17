import { Progress } from "@/components/ui/progress";

type SurveyMeterProps = {
  label: string;
  score: string;
  value: number;
  colorClass: string;
};

export function SurveyMeter({ label, score, value, colorClass }: SurveyMeterProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium text-gray-600">{label}</span>
        <span className={`font-bold ${colorClass}`}>{score}</span>
      </div>
      <Progress value={value} className="h-2 bg-gray-100 [&>div]:bg-current" />
    </div>
  );
}

