/**
 * Re-export barrel for team actions.
 * Allows sub-pages under [teamId]/ to import from "../actions".
 */
export {
  createTeam,
  getArts,
  getTeamById,
  getTeams,
  type TeamMember,
  updateTeamConfig,
} from "../actions";
