import { Badge } from "@/components/ui/badge";
import { GoalAchievement as GoalAchievementType } from "@/types/text-analysis";

interface GoalAchievementProps {
  goalAchievement?: GoalAchievementType;
}

export const GoalAchievement = ({ goalAchievement }: GoalAchievementProps) => {
  if (!goalAchievement) return null;

  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="text-xl font-semibold mb-4">Progress</h2>
      <div className="space-y-4">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Score</span>
              <span className="text-sm font-medium">
                {goalAchievement.score}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${goalAchievement.score}%` }}
              />
            </div>
          </div>
          <Badge variant={goalAchievement.achieved ? "default" : "secondary"}>
            {goalAchievement.achieved ? "Achieved" : "In Progress"}
          </Badge>
        </div>
        {goalAchievement.remaining_steps.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2">Remaining Steps</h3>
            <ul className="space-y-2">
              {goalAchievement.remaining_steps.map(
                (step: string, index: number) => (
                  <li
                    key={index}
                    className="flex items-start space-x-2 text-muted-foreground"
                  >
                    <span className="select-none">•</span>
                    <span className="text-sm">{step}</span>
                  </li>
                )
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
