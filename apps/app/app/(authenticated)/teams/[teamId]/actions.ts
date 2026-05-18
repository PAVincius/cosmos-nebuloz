/**
 * Re-export barrel for team actions.
 * Allows sub-pages under [teamId]/ to import from "../actions".
 */
export {
  getTeamById,
  getTeams,
  getArts,
  createTeam,
  updateTeamConfig,
  type TeamMember,
} from "../actions";
