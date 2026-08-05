# Graph Report - .  (2026-07-11)

## Corpus Check
- Large corpus: 770 files · ~337,305 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 4325 nodes · 8089 edges · 310 communities (277 shown, 33 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 39 edges (avg confidence: 0.67)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 101
- Community 102
- Community 103
- Community 104
- Community 105
- Community 106
- Community 107
- Community 108
- Community 109
- Community 110
- Community 111
- Community 112
- Community 113
- Community 114
- Community 115
- Community 116
- Community 117
- Community 118
- Community 119
- Community 120
- Community 121
- Community 122
- Community 123
- Community 124
- Community 125
- Community 126
- Community 127
- Community 128
- Community 129
- Community 130
- Community 131
- Community 132
- Community 133
- Community 134
- Community 135
- Community 136
- Community 137
- Community 138
- Community 139
- Community 140
- Community 141
- Community 142
- Community 143
- Community 144
- Community 145
- Community 146
- Community 147
- Community 148
- Community 149
- Community 150
- Community 151
- Community 152
- Community 153
- Community 154
- Community 155
- Community 156
- Community 157
- Community 158
- Community 159
- Community 160
- Community 161
- Community 162
- Community 163
- Community 164
- Community 165
- Community 166
- Community 167
- Community 168
- Community 169
- Community 170
- Community 171
- Community 172
- Community 173
- Community 174
- Community 175
- Community 176
- Community 177
- Community 178
- Community 179
- Community 180
- Community 181
- Community 182
- Community 183
- Community 184
- Community 185
- Community 186
- Community 187
- Community 188
- Community 189
- Community 190
- Community 191
- Community 192
- Community 193
- Community 194
- Community 195
- Community 196
- Community 197
- Community 198
- Community 199
- Community 200
- Community 201
- Community 202
- Community 203
- Community 204
- Community 205
- Community 206
- Community 207
- Community 208
- Community 209
- Community 210
- Community 211
- Community 212
- Community 213
- Community 214
- Community 215
- Community 216
- Community 218
- Community 219
- Community 220
- Community 221
- Community 224
- Community 228
- Community 236
- Community 237
- Community 238
- Community 239
- Community 240
- Community 241
- Community 243
- Community 244
- Community 245
- Community 249
- Community 250
- Community 252
- Community 253
- Community 254
- Community 255
- Community 257
- Community 258
- Community 259
- Community 261
- Community 263
- Community 264
- Community 265
- Community 266
- Community 267
- Community 268
- Community 274
- Community 309

## God Nodes (most connected - your core abstractions)
1. `safeAction()` - 340 edges
2. `Result` - 85 edges
3. `err` - 62 edges
4. `PageHeader()` - 59 edges
5. `logAudit()` - 55 edges
6. `enforce()` - 46 edges
7. `ok` - 43 edges
8. `RelationChip()` - 32 edges
9. `KpiCard()` - 31 edges
10. `KpiGrid()` - 31 edges

## Surprising Connections (you probably didn't know these)
- `BudgetDashboard()` --indirect_call--> `pct()`  [INFERRED]
  app/(authenticated)/portfolio/budgets/components/budget-dashboard.tsx → app/(authenticated)/analytics/history/components/history-view.tsx
- `SnapshotMiniChart()` --indirect_call--> `pct()`  [INFERRED]
  app/(authenticated)/portfolio/okrs/components/okr-detail-panel.tsx → app/(authenticated)/analytics/history/components/history-view.tsx
- `ScenarioSimulator()` --indirect_call--> `pct()`  [INFERRED]
  app/(authenticated)/portfolio/wsjf/components/scenario-simulator.tsx → app/(authenticated)/analytics/history/components/history-view.tsx
- `generateMetadata()` --calls--> `getARTById()`  [EXTRACTED]
  app/(authenticated)/arts/[artId]/post-pi/page.tsx → app/actions/arts/get-arts.ts
- `LACEPage()` --indirect_call--> `BookOpenIcon()`  [INFERRED]
  app/(authenticated)/lace/page.tsx → app/(authenticated)/components/copilot/copilot-icons.tsx

## Import Cycles
- None detected.

## Communities (310 total, 33 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.03
Nodes (77): getBenchmarkComparison(), getBenchmarkComparisonSchema, getFlowMetrics(), getFlowMetricsSchema, getForecast(), getForecastSchema, Result, safeAction() (+69 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (67): logAudit(), AuditLogWithUser, createKeyResult(), createStrategicTheme(), createThemeOkr(), deleteKeyResult(), deleteStrategicTheme(), deleteThemeOkr() (+59 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (58): PageMeta, cancelApprovalRequest(), DEFAULT_WORKFLOWS, ensureDefaultWorkflows(), getApprovalRequest(), GOVERNANCE_ROLE_MAP, listApprovalRequests(), listDecisionLog() (+50 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (46): buildDeepLink(), generateAndDeliverPrompt(), PromptTarget, systemPromptForTarget(), ragSearch(), autosaveBusinessCase(), AutosaveBusinessCaseSchema, AutosaveInput (+38 more)

### Community 4 - "Community 4"
Cohesion: 0.05
Nodes (50): createNewVoteRound(), createReplanSession(), getAllPISessions(), getOrCreatePISession(), getOrCreateVoteRound(), getOrCreateVoteSession(), sendVoteEvent(), getPIPlanById() (+42 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (47): cuid, DefectStatus, ImpedimentStatus, IntegrationStatus, isoDate, nnStr, optCuid, optDate (+39 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (43): createRisk(), CreateRiskSchema, deleteRisk(), getPIPlans(), getRisks(), updateRisk(), updateRiskStatus(), RiskWithPI (+35 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (35): Props, STEPS, CompanyProfileFormData, LOCALES, StepCompanyProfile(), StepCompanyProfileProps, TIMEZONES, validateCompanyProfile() (+27 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (30): EpicForTheme, calcProgress(), EpicNode, getStrategyMapData(), OKRNode, PillarThemeSummary, StrategyMapData, ThemeNode (+22 more)

### Community 9 - "Community 9"
Cohesion: 0.09
Nodes (32): RoadmapStatus, createRoadmapItem(), deleteRoadmapItem(), durationDays(), getRoadmapItemById(), getRoadmapItems(), listRoadmapItems(), updateRoadmapItem() (+24 more)

### Community 10 - "Community 10"
Cohesion: 0.09
Nodes (35): archiveQuarterOKRs(), ART_LEVEL_OKR_TYPES, calcProgress(), createAutomatedSnapshot(), createKeyResultCheckIn(), createOKR(), getOKRById(), getOKRs() (+27 more)

### Community 11 - "Community 11"
Cohesion: 0.08
Nodes (20): ArtOption, defaultForm(), EditValueStreamModal(), EditValueStreamModalProps, FIELD_STYLE, FormState, HORIZON_OPTIONS, TONE_OPTIONS (+12 more)

### Community 12 - "Community 12"
Cohesion: 0.08
Nodes (28): IntegrationType, deleteIntegration(), getIntegrationByType(), listIntegrations(), TODO: Migrate config tokens/passwords from plain text DB storage to a secrets, testIntegration(), toPublic(), upsertIntegration() (+20 more)

### Community 13 - "Community 13"
Cohesion: 0.10
Nodes (32): getFlowScopeOptions(), createAssessment(), createAssessmentAction(), createImprovementAction(), createImprovementActionResult(), listAllAssessments(), listAllImprovementActions(), listAssessments() (+24 more)

### Community 14 - "Community 14"
Cohesion: 0.10
Nodes (32): createLeanBudget(), deleteLeanBudget(), getBudgetSummary(), getLeanBudgetById(), getLeanBudgets(), linkBudgetToTheme(), listBudgetsByTheme(), listLeanBudgets() (+24 more)

### Community 15 - "Community 15"
Cohesion: 0.08
Nodes (21): KpiTone, defaultForm(), EditHorizonModal(), EditHorizonModalProps, FIELD_STYLE, FormState, HORIZON_IDS, TONE_OPTIONS (+13 more)

### Community 16 - "Community 16"
Cohesion: 0.10
Nodes (27): getStrategicThemes(), ThemeTypeType, NewThemeButton(), NewThemeButtonProps, COLOR_OPTIONS, INITIAL_NEW_THEME_FORM, NewThemeForm(), NewThemeFormProps (+19 more)

### Community 17 - "Community 17"
Cohesion: 0.09
Nodes (25): WizardStepHeader(), OnboardingWizardShell(), OnboardingWizardShellProps, WizardStepMeta, Props, STEPS, ConnectFormData, Props (+17 more)

### Community 18 - "Community 18"
Cohesion: 0.09
Nodes (22): CARD_TEMPLATES, CardConfigPanel(), CardDisplayCfg, CFG_KEYS, cfgMatchTemplate(), DEFAULT_CARD_CFG, Props, TOGGLE_FIELDS (+14 more)

### Community 19 - "Community 19"
Cohesion: 0.09
Nodes (24): ARTEvent, ARTHealthIndicators, ARTObservabilityData, PIHealthSummary, ARTEventTimeline(), ARTEventTimelineProps, EVENT_CONFIG, formatDate() (+16 more)

### Community 20 - "Community 20"
Cohesion: 0.09
Nodes (24): createImpediment(), deleteImpediment(), getImpedimentById(), listImpediments(), listImpedimentsByArt(), resolveImpediment(), updateImpediment(), CreateImpedimentSchema (+16 more)

### Community 21 - "Community 21"
Cohesion: 0.13
Nodes (29): pushNotification(), approvePAERequest(), APPROVER_ROLES, createPAERequest(), denyPAERequest(), ENTITY_TABLE_MAP, listPAERequests(), resolveApprovers() (+21 more)

### Community 22 - "Community 22"
Cohesion: 0.13
Nodes (26): syncTenantKnowledge(), createCopilotSession(), deleteCopilotSession(), listCopilotSessions(), loadCopilotSession(), pinCopilotSession(), SessionPreview, StoredMessage (+18 more)

### Community 23 - "Community 23"
Cohesion: 0.12
Nodes (26): syncEpicCounts(), syncPIPlanCompletion(), portfolioEpicsCacheTag(), updateEpicStatus(), buildFeatureUpdateData(), buildStatusFields(), createFeature(), CreateFeatureSchema (+18 more)

### Community 24 - "Community 24"
Cohesion: 0.11
Nodes (27): createNotification(), deleteNotification(), deleteReadNotifications(), getNotifications(), getUnreadCount(), getUnreadCountRaw(), listNotifications(), markAllAsRead() (+19 more)

### Community 25 - "Community 25"
Cohesion: 0.09
Nodes (24): createRisk(), RoamStatus, updateRiskStatus(), chunkText(), Chunk, embedAndUpsertBatch(), EntityContent, fetchEntityContent() (+16 more)

### Community 26 - "Community 26"
Cohesion: 0.09
Nodes (27): createSolutionTrain(), deleteSolutionTrain(), getSolutionTrainById(), listSolutionTrains(), updateSolutionTrain(), ArtWithTeamCount, CreateSolutionTrainInput, CreateSolutionTrainSchema (+19 more)

### Community 27 - "Community 27"
Cohesion: 0.10
Nodes (25): GitHubDeploymentStatusPayload, GitHubGenericPayload, GitHubPRPayload, GitHubWebhookPayload, handleDeploymentStatus(), handleGitHubWebhook(), handleLegacyIssue(), handlePREvent() (+17 more)

### Community 28 - "Community 28"
Cohesion: 0.10
Nodes (25): AnomalyRow, AnomalyStats, listRecentAnomalies(), AnomalyList(), buildGovernanceUrl(), getSnoozed(), Props, RULE_LABELS (+17 more)

### Community 29 - "Community 29"
Cohesion: 0.12
Nodes (22): CycleTimeData, CycleTimePoint, getCycleTimeData(), percentile(), BurnupPoint, getPIBurnupData(), PIBurnupData, computeTeamCapability() (+14 more)

### Community 30 - "Community 30"
Cohesion: 0.11
Nodes (22): logBudgetChange(), logThemeChange(), DecisionInput, logDecision(), applyInsight(), ApplyInsightSchema, dismissInsight(), DismissInsightSchema (+14 more)

### Community 31 - "Community 31"
Cohesion: 0.13
Nodes (26): COLUMN_TO_TRANSITION_EVENT, loadKanbanConfig(), mergeWithDefaults(), moveEpicAction(), persistConfig(), resetKanbanColumns(), TenantMetadata, updateColumnColor() (+18 more)

### Community 32 - "Community 32"
Cohesion: 0.09
Nodes (22): CreatePIWizard(), WizardBody(), WizardChromeDraft, WizardChromeHeader(), WizardFooterNav(), Art, CreateTeamWizard(), MEMBER_ROLES (+14 more)

### Community 33 - "Community 33"
Cohesion: 0.10
Nodes (20): ExecutiveDashboardSchema, getExecutiveDashboard(), getExecutiveTrends(), AnomalyFeed(), Props, SEV_VARIANT, ArtHealthTable(), HEALTH_VARIANT (+12 more)

### Community 34 - "Community 34"
Cohesion: 0.12
Nodes (24): buildPage(), CapabilityStatus, paginationArgs(), createCapability(), deleteCapability(), getCapabilityById(), listCapabilities(), reorderCapabilities() (+16 more)

### Community 35 - "Community 35"
Cohesion: 0.12
Nodes (21): dispatchEvent(), DomainEvent, handleAudit(), handleNotifications(), findRecipientsByRole(), activateSprint(), completeSprint(), createSprint() (+13 more)

### Community 36 - "Community 36"
Cohesion: 0.12
Nodes (19): getLACE(), getTenantMembersForSearch(), BookOpenIcon(), LACEPage(), LACEWorkspace, metadata, createTeam(), getArts() (+11 more)

### Community 37 - "Community 37"
Cohesion: 0.11
Nodes (24): buildDependencies(), buildSprints(), buildUserToTeamIndex(), FeatureRecord, getPIPlansByART(), getProgramBoardData(), initMatrix(), placeFeatures() (+16 more)

### Community 38 - "Community 38"
Cohesion: 0.10
Nodes (23): DataTable(), DataTableColumn, DataTableProps, ART_PALETTE, ARTOption, BillingIntegration, BudgetDashboard(), BudgetFormState (+15 more)

### Community 39 - "Community 39"
Cohesion: 0.10
Nodes (19): RelationChipTone, badgeVariants, BentoCell(), BentoCellProps, BentoGrid(), CellEyebrow(), CellLabel(), CellSub() (+11 more)

### Community 40 - "Community 40"
Cohesion: 0.12
Nodes (21): OKRStatus, createKeyResult(), deleteKeyResult(), deleteOKR(), updateOKRStatus(), KeyResultWithProgress, OKRWithContext, AddKeyResultRowProps (+13 more)

### Community 41 - "Community 41"
Cohesion: 0.10
Nodes (21): COMPETENCIES, CompetencyId, updateActionStatus(), ActionStatus, ActionStatusValue, AssessmentAction, AssessmentWithActions, chipStyle() (+13 more)

### Community 42 - "Community 42"
Cohesion: 0.12
Nodes (21): CopilotFab(), CopilotHeader(), CopilotHeaderProps, MODE_LABELS, SURFACE_LABELS, BotIcon(), panelVariants, CopilotPromptChips() (+13 more)

### Community 43 - "Community 43"
Cohesion: 0.11
Nodes (22): closeDefect(), createDefect(), deleteDefect(), getDefectById(), listDefects(), resolveDefect(), updateDefect(), DefectFiltersSchema (+14 more)

### Community 44 - "Community 44"
Cohesion: 0.14
Nodes (19): costSummaryByTheme(), CostSummaryResult, costTrendByMonth(), MonthlyTrendRow, ThemeCostRow, CostAllocationTable(), formatUSD(), Props (+11 more)

### Community 45 - "Community 45"
Cohesion: 0.11
Nodes (14): analyzeFlowAnomalies(), AnalyzeResult, createAutoActionsForCritical(), Err, Ok, AnomalyRuleInput, AnomalyRuleName, AnomalySeverity (+6 more)

### Community 46 - "Community 46"
Cohesion: 0.11
Nodes (20): KanbanColumnConfig, BoardBadge, BoardCard(), BoardCardProps, BoardColumn(), BoardColumnProps, BoardTone, cardReveal (+12 more)

### Community 47 - "Community 47"
Cohesion: 0.12
Nodes (22): AwsPriceResult, awsPricingTool, buildAwsResult(), buildGcpResult(), computeGcpSkuPrice(), extractOfferResult(), extractPriceFromDimension(), fetchAwsPrice() (+14 more)

### Community 48 - "Community 48"
Cohesion: 0.13
Nodes (20): getAuditLogsByEntity(), listAuditLogs(), writeAuditLog(), AuditAction, AuditActionSchema, AuditFilters, AuditFiltersSchema, AuditLog (+12 more)

### Community 49 - "Community 49"
Cohesion: 0.11
Nodes (16): CreatePIPlanDetailsInput, PIObjectiveInput, PIRiskInput, CATEGORY_OPTIONS, CreatePIWizardProps, FeatureOption, IMPACT_OPTIONS, PIWizardDraft (+8 more)

### Community 50 - "Community 50"
Cohesion: 0.10
Nodes (17): TagRuleCondition, ModalShell(), ModalShellProps, SIZE_WIDTH, SPRING_EASE, EditEpicButton(), EditEpicButtonProps, FIELD_INPUT_STYLE (+9 more)

### Community 51 - "Community 51"
Cohesion: 0.17
Nodes (17): buildFathomWebhookUrl(), fathomTestConnection(), buildFirefliesWebhookUrl(), firefliesTestConnection(), ADMIN_ROLES, appBaseUrl(), connectFathom(), ConnectFathomSchema (+9 more)

### Community 52 - "Community 52"
Cohesion: 0.13
Nodes (20): getWSJFConfig(), isWSJFConfig(), AI_REBALANCE_LIMITS, AIUsageMeta, buildPortfolioContext(), buildTitleMap(), buildWSJFMessages(), FeatureSuggestionLLMSchema (+12 more)

### Community 53 - "Community 53"
Cohesion: 0.11
Nodes (18): FullScreenLoader(), FullScreenLoaderProps, Search(), buildNavData(), GlobalSidebar(), GlobalSidebarProperties, NAV_GROUPS_BY_ROLE, NavGroup (+10 more)

### Community 54 - "Community 54"
Cohesion: 0.12
Nodes (18): AreaChart(), AreaChartProps, ChartTone, TONE_RGB, TONE_VAR, currencyFormatter, HBarDatum, HBars() (+10 more)

### Community 55 - "Community 55"
Cohesion: 0.15
Nodes (21): RoadmapBar(), computeProgress(), getBarTone(), packLaneRows(), RoadmapGantt(), RoadmapGanttProps, buildFixedQuarterColumns(), buildLanes() (+13 more)

### Community 56 - "Community 56"
Cohesion: 0.16
Nodes (18): switchOrg(), SwitchOrgResult, SwitchOrgSchema, err, ok, toActionError(), listPersonSkillProfiles(), PersonSkillProfile (+10 more)

### Community 57 - "Community 57"
Cohesion: 0.12
Nodes (14): computeMemberBaseline(), Err, getTeamCapacityDashboard(), Member, Ok, percentile(), CapacityForecastChart(), Props (+6 more)

### Community 58 - "Community 58"
Cohesion: 0.12
Nodes (20): createPIsFromOnboarding(), createSAFeStructureFromOnboarding(), ARTInputSchema, CompanyProfileData, CompanyProfileSchema, FlowTypeSchema, InviteUserSchema, OrgChartData (+12 more)

### Community 59 - "Community 59"
Cohesion: 0.12
Nodes (19): OtherTenantMemberResult, SearchMembersResult, searchMembersWithCrossTenant(), sendMemberInvite(), SendMemberInviteInput, SendMemberInviteResult, TenantMemberResult, Avatar() (+11 more)

### Community 60 - "Community 60"
Cohesion: 0.13
Nodes (15): DEFAULT_CONFIG, EpicWithFeatures, FeatureWSJF, WSJFConfig, WSJFLabels, ScorePicker(), ScorePickerProps, costOfDelay() (+7 more)

### Community 61 - "Community 61"
Cohesion: 0.14
Nodes (17): consistencyScore(), EASE_STANDARD, Props, SERIES_TONES, SeriesTone, TONE_COLOR, VelocityDashboard(), ArtKpiRowProps (+9 more)

### Community 62 - "Community 62"
Cohesion: 0.11
Nodes (17): SectionCard(), SectionCardProps, FeatureRow, FeaturesSection(), FeaturesSectionProps, STATUS_CONFIG, HypothesisSection(), HypothesisSectionProps (+9 more)

### Community 63 - "Community 63"
Cohesion: 0.13
Nodes (15): createPIObjective(), createPIPlan(), createPIPlanWithDetails(), generatePIName(), getQuarter(), PIPlanDetails, PIPlanFullDetails, updatePIObjective() (+7 more)

### Community 64 - "Community 64"
Cohesion: 0.15
Nodes (17): SupplierStatus, createSupplier(), deactivateSupplier(), deleteSupplier(), getSupplierById(), listSuppliers(), updateSupplier(), CreateSupplierInput (+9 more)

### Community 65 - "Community 65"
Cohesion: 0.12
Nodes (16): extractTranscription(), suggestTitle(), AI_TOOLS, AIActionButtons(), AITool, Props, ALL_TYPES, EpicCreateModal() (+8 more)

### Community 66 - "Community 66"
Cohesion: 0.11
Nodes (18): updateFeatureWSJF(), WSJFResult, ConfidenceVoteEventSchema, CreateARTInput, CreatePIPlanInput, EPIC_STATUSES, id, jobSize (+10 more)

### Community 67 - "Community 67"
Cohesion: 0.12
Nodes (17): CreateIntegrationInput, ImportMappingInput, IntegrationRow, IntegrationSource, IntegrationSourceSchema, ConnectWizard(), Props, STEP_EYEBROW (+9 more)

### Community 68 - "Community 68"
Cohesion: 0.12
Nodes (16): getOKRTraceability(), OKRTraceabilityNode, OkrBadge(), OkrBadgeProps, OkrBadgeTone, TONE_STYLE, OKRTone, OKRTraceabilityView() (+8 more)

### Community 69 - "Community 69"
Cohesion: 0.19
Nodes (14): ARTsContext, buildARTsContext(), buildFlowMetricsContext(), FlowMetricsContext, buildCopilotContext(), buildLeanBudgetContext(), LeanBudgetContext, buildPIWorkspaceContext() (+6 more)

### Community 70 - "Community 70"
Cohesion: 0.17
Nodes (18): CopilotContext, saveCopilotMessages(), getModeMessages(), MODE_PERSONAS, ModePersona, summarizeContext(), checkCopilotQuota(), COPILOT_LIMITS (+10 more)

### Community 71 - "Community 71"
Cohesion: 0.17
Nodes (18): applySuggestion(), createCopilotSuggestion(), discardSuggestion(), parseSuggestionId(), StoredSuggestion, StoredSuggestionSchema, SuggestionPayload, SuggestionPayloadSchema (+10 more)

### Community 72 - "Community 72"
Cohesion: 0.16
Nodes (18): getActiveSprint(), deleteStandupEntry(), getStandupHistory(), listTodayStandup(), normalizeDateToMidnightUTC(), StandupFiltersSchema, upsertStandupEntry(), UpsertStandupSchema (+10 more)

### Community 73 - "Community 73"
Cohesion: 0.11
Nodes (13): getSprintById(), AddStoryToSprintDialog(), AddStoryToSprintDialogProps, generateMetadata(), PRIORITY_COLORS, SprintData, SprintDetailPage(), SprintDetailPageProps (+5 more)

### Community 74 - "Community 74"
Cohesion: 0.18
Nodes (17): addDays(), buildSprintWindows(), getMemberVelocityStats(), getSprintBurndownData(), getTeamVelocityStats(), startOfDay(), TeamMemberEntry, BurndownEntry (+9 more)

### Community 75 - "Community 75"
Cohesion: 0.15
Nodes (16): CopilotMarkdown(), MD_COMPONENTS, normalizeMarkdown(), Props, StableMarkdown, stripEmojis(), CopilotReport(), CopilotReportProps (+8 more)

### Community 76 - "Community 76"
Cohesion: 0.15
Nodes (15): ART_TONES, computePredictability(), getHistoryOverview(), HistoryOverview, HistoryPastPi, HistoryRetiredArt, quarterLabel(), toneForIndex() (+7 more)

### Community 77 - "Community 77"
Cohesion: 0.14
Nodes (17): saveWSJFConfig(), ExplainabilityPanel(), ExplainabilityPanelProps, ExplainabilitySuggestion, IMPACT_LABELS, isDefaultWeights(), FeatureForScenario, ScenarioSimulator() (+9 more)

### Community 78 - "Community 78"
Cohesion: 0.13
Nodes (14): CreateDependencyModal(), CreateDependencyModalProps, FIELD_STYLE, LABEL_STYLE, DepCard(), DependenciesEpic, DependencyDashboardProps, DependencyLegend() (+6 more)

### Community 79 - "Community 79"
Cohesion: 0.16
Nodes (17): badgeStyle(), btnStyle(), ImportWizard(), ImportWizardProps, pillStyle(), ss, StatusBadge(), Step (+9 more)

### Community 80 - "Community 80"
Cohesion: 0.16
Nodes (14): computeCadenceDays(), computeEpicConfidence(), EpicConfidenceSchema, getEpicConfidence(), getPortfolioConfidence(), ConfidenceBadge(), ConfidenceBadgeProps, DOT_COLOR (+6 more)

### Community 81 - "Community 81"
Cohesion: 0.14
Nodes (12): canTransition(), GOVERNANCE_STATES, GovernanceState, TRANSITIONS, transitionEpic(), TransitionEpicInput, TransitionSchema, EpicGovernanceCard() (+4 more)

### Community 82 - "Community 82"
Cohesion: 0.19
Nodes (16): verifyGitHubSignature(), verifyLinearSignature(), checkWebhookRateLimit(), DispatchArgs, dispatchEvent(), enqueueToInngest(), isAlreadyProcessed(), logInvalidSignature() (+8 more)

### Community 83 - "Community 83"
Cohesion: 0.21
Nodes (15): createCustomRole(), CreateRoleSchema, CustomRoleRow, deleteCustomRole(), listCustomRoles(), updateCustomRole(), ALLOWED_PERMISSIONS, AllowedPermission (+7 more)

### Community 84 - "Community 84"
Cohesion: 0.18
Nodes (14): getWorkspaceSettings(), DATE_FORMATTER, IdentityCard(), IdentityCardProps, initialsOf(), PlanCard(), PlanCardProps, PLAN_DESCRIPTIONS (+6 more)

### Community 85 - "Community 85"
Cohesion: 0.19
Nodes (15): createSolutionEpic(), deleteSolutionEpic(), getSolutionEpicById(), updateSolutionEpic(), CreateSolutionEpicInput, CreateSolutionEpicSchema, SolutionEpicFilters, SolutionEpicFiltersSchema (+7 more)

### Community 86 - "Community 86"
Cohesion: 0.16
Nodes (16): Assessment, COMPETENCY_LABEL, COMPETENCY_SHORT, CompetencyRadar(), Props, Assessment, MaturityOverview(), MaturityOverviewProps (+8 more)

### Community 87 - "Community 87"
Cohesion: 0.11
Nodes (14): BoardCellProps, computeConflictData(), DepLine, FeatureCardProps, LEGEND, PlacedFeature, ProgramBoardClient(), ProgramBoardClientProps (+6 more)

### Community 88 - "Community 88"
Cohesion: 0.12
Nodes (16): COLUMN_KEYS, COLUMNS, CreateStoryDialogProps, KanbanBoard(), KanbanBoardProps, KanbanMember, PRIORITY_BADGES, PRIORITY_LABELS (+8 more)

### Community 89 - "Community 89"
Cohesion: 0.18
Nodes (13): deleteArtifact(), listArtifacts(), saveArtifact(), TenantMeta, SaveArtifactInput, SaveArtifactSchema, ArtifactBrowser(), Props (+5 more)

### Community 90 - "Community 90"
Cohesion: 0.15
Nodes (17): ALLOWED_ROLES_RTE, CommitGateOpts, computeAchievedValues(), createART(), CreateARTSchema, createPIPlanWithSprints(), CreatePIPlanWithSprintsSchema, generateSprints() (+9 more)

### Community 91 - "Community 91"
Cohesion: 0.18
Nodes (15): Page, CreateReportSchema, createScheduledReport(), deleteScheduledReport(), listScheduledReports(), UpdateReportSchema, updateScheduledReport(), metadata (+7 more)

### Community 92 - "Community 92"
Cohesion: 0.24
Nodes (15): StoryStatus, syncFeatureProgress(), syncTeamWip(), enforce(), createStory(), CreateStorySchema, deleteStory(), getStoryById() (+7 more)

### Community 93 - "Community 93"
Cohesion: 0.16
Nodes (11): getPortfolioEpics(), getPortfolioKanbanConfig(), getViewerRole(), Slide, SLIDES, WalkthroughModal(), HEADER_BREADCRUMB, metadata (+3 more)

### Community 94 - "Community 94"
Cohesion: 0.16
Nodes (15): buildEvent(), FAST_FORWARD_PATH, fastForwardToState(), hasDefinedTransition(), LIFECYCLE_STATES, LifecycleStatus, STATE_VALID_EVENTS, SystemTransitionInput (+7 more)

### Community 95 - "Community 95"
Cohesion: 0.20
Nodes (14): getGlobalHomeData(), getHomeConfig(), getLpmHomeData(), getPmHomeData(), getRteHomeData(), getSmHomeData(), HomeConfig, ROLE_TO_PERSONA (+6 more)

### Community 96 - "Community 96"
Cohesion: 0.21
Nodes (15): githubDiscoverProjects(), githubImportProjectItems(), GitHubProject, GitHubProjectItem, githubStateToStatus(), githubTestConnection(), GitHubViewer, linearDiscoverTeams() (+7 more)

### Community 97 - "Community 97"
Cohesion: 0.14
Nodes (17): activateSprint(), activateSprintSchema, BOARD_COLUMNS, checkEstimationDrift(), checkEstimationDriftSchema, closeSprint(), closeSprintSchema, createSprintAnomaly() (+9 more)

### Community 98 - "Community 98"
Cohesion: 0.19
Nodes (14): getMyProfile(), getNotificationPreferences(), updateNotificationPreferences(), updateProfile(), NOTIFICATION_TYPES, NotificationPreferencesForm(), NotificationPrefsFormProps, ProfileForm() (+6 more)

### Community 99 - "Community 99"
Cohesion: 0.18
Nodes (15): AnalyticsEmptyBanners(), Props, ExecutiveROISummary(), healthColor(), healthLabel(), predictabilitySub(), Props, thresholdColor() (+7 more)

### Community 100 - "Community 100"
Cohesion: 0.11
Nodes (14): BPMNLINT_RULES, ConditionalFlows, EndEventRequired, FakeJoin, { is: bpmnIs }, LabelRequired, NoComplexGateway, NoDisconnected (+6 more)

### Community 101 - "Community 101"
Cohesion: 0.13
Nodes (11): getPIPlanWithDetails(), PIPlanDetails, PIPlanFullDetails, OBJ_STATUS_CONFIG, PISummaryViewProps, ROAM_CONFIG, VOTE_STATE_CONFIG, PiWorkspaceTabsProps (+3 more)

### Community 102 - "Community 102"
Cohesion: 0.20
Nodes (12): BudgetOverviewItem, getBudgetOverview(), getBudgetById(), BudgetDetail(), getProgressColor(), Props, COLORS, CostBreakdownCard() (+4 more)

### Community 103 - "Community 103"
Cohesion: 0.15
Nodes (10): getEpicFeatures(), BreadcrumbItem, PageHeader(), PageHeaderProps, StatItem, PmHomeProps, PmHomeBodySkeleton(), EpicFeaturesPage() (+2 more)

### Community 104 - "Community 104"
Cohesion: 0.19
Nodes (12): enforceWithPAE(), EnforceWithPAEParams, can(), EntityType, MemberRole, POLICIES, Policy, PolicyAction (+4 more)

### Community 105 - "Community 105"
Cohesion: 0.12
Nodes (14): ActionItem, AssessmentItem, AssessmentsTab(), SCOPE_LABELS, ScopeOption, SCORE_COLORS, SCORE_LABELS, ImprovementActionsTab() (+6 more)

### Community 106 - "Community 106"
Cohesion: 0.17
Nodes (11): createART(), getARTs(), CreateARTSchema, getSuppliers(), CADENCE_PRESETS, ARTsPage(), CreateARTDialog, metadata (+3 more)

### Community 107 - "Community 107"
Cohesion: 0.24
Nodes (12): generateAC(), improveDescription(), EpicDrawerDescription(), escapeHtml(), loadContent(), markdownToHtml(), Props, filterSlashItems() (+4 more)

### Community 108 - "Community 108"
Cohesion: 0.18
Nodes (12): epicInclude, EpicWithRelations, getPortfolioEpicsInitialPages(), getPortfolioEpicsPage(), loadOkrCountMap(), loadPortfolioEpics(), loadPortfolioEpicsPage(), mapEpicRow() (+4 more)

### Community 109 - "Community 109"
Cohesion: 0.20
Nodes (14): checkSnapshotStaleness(), CheckStalenessResponse, CheckStalenessResult, computeStaleness(), evaluateAgeRule(), evaluateAssessmentAgeRule(), evaluateCompositionRule(), evaluateMultiMetricRule() (+6 more)

### Community 110 - "Community 110"
Cohesion: 0.17
Nodes (13): listIntegrations(), SyncLogRow, getEpicsWithFeatureWSJF(), IntegrationHub(), IntegrationHealthPage(), metadata, STATUS_CONFIG, STATUS_SOURCE_LABELS (+5 more)

### Community 111 - "Community 111"
Cohesion: 0.17
Nodes (11): PortfolioAllocation, ThemeAllocation, ThemeListItem, Gauge(), GaugeProps, GaugeTone, BRL(), BudgetAllocationPanel() (+3 more)

### Community 112 - "Community 112"
Cohesion: 0.17
Nodes (12): closePIPlan(), saveSessionNotes(), ClosePIButton(), ClosePIButtonProps, LessonsLearnedForm(), LessonsLearnedFormProps, generateMetadata(), OBJ_STATUS_LABELS (+4 more)

### Community 113 - "Community 113"
Cohesion: 0.19
Nodes (11): CopilotStepsTimeline(), Props, CopilotToolCallStep(), Props, TOOL_LABELS, ChatMessage, ToolInvocation, ToolInvocationState (+3 more)

### Community 114 - "Community 114"
Cohesion: 0.17
Nodes (12): getFeatureById(), ExternalSourceBadge(), Props, SOURCE_CONFIG, EditFeatureDialog(), EditFeatureDialogProps, FEATURE_STATUSES, FeaturePage() (+4 more)

### Community 115 - "Community 115"
Cohesion: 0.17
Nodes (11): linearImportTeamIssues(), LinearIssue, linearStateToStatus(), LinearTeam, STATE_TYPE_MAP, DryRunResult, ExecuteResult, ImportInput (+3 more)

### Community 116 - "Community 116"
Cohesion: 0.18
Nodes (12): isOnboardingComplete(), detectPrimaryRole(), CommandPalette(), GROUPS, NAV_ENTRIES, NavEntry, CopilotProvider(), NotificationsProvider() (+4 more)

### Community 117 - "Community 117"
Cohesion: 0.19
Nodes (9): ROLE_MAP, ROLE_PRIORITY, SAFeRole, ROLE_CHIPS, SuggestedChip, ROLE_PROMPTS, Props, ROLE_CONFIG (+1 more)

### Community 118 - "Community 118"
Cohesion: 0.16
Nodes (11): getVelocityOverview(), dominantTrend(), metadata, Trend, TREND_META, VelocityPage(), PiRelationChipProps, RelationChip() (+3 more)

### Community 119 - "Community 119"
Cohesion: 0.16
Nodes (11): CapabilityGapCard(), GapCardProps, CapabilityEntry, CapabilityMatrix(), Props, TeamRow, CapabilityPrivacyNotice(), CapabilityTab() (+3 more)

### Community 120 - "Community 120"
Cohesion: 0.19
Nodes (13): computeEndDate(), CreatePIWizardV2(), CreatePIWizardV2Props, DraftObjective, DURATION_OPTIONS, formatDate(), getQuarter(), inputStyle (+5 more)

### Community 121 - "Community 121"
Cohesion: 0.22
Nodes (13): ROLE_LABELS, ROLE_TONE, RolePill(), roleTone(), StatusPill(), Tone, toneStyle(), MemberRow (+5 more)

### Community 122 - "Community 122"
Cohesion: 0.20
Nodes (13): getARTById(), getARTObservability(), getBacklogFeatures(), getTeamsForART(), ARTDetailPage(), generateMetadata(), PostPIPage(), generateMetadata() (+5 more)

### Community 123 - "Community 123"
Cohesion: 0.16
Nodes (13): checkDefectStaleness(), checkDefectStalenessSchema, createDefect(), createDefectAnomaly(), createDefectSchema, reopenDefect(), reopenDefectSchema, SEVERITY_DOWNGRADE_ROLES (+5 more)

### Community 124 - "Community 124"
Cohesion: 0.24
Nodes (10): createEpic(), CreateEpicInput, CreateEpicSchema, PortfolioEpic, UpdateEpicInput, UpdateEpicSchema, updateEpic(), EpicQuickAddModal() (+2 more)

### Community 125 - "Community 125"
Cohesion: 0.19
Nodes (10): CapabilityGap, capabilityGapSchema, InitiativeDemand, initiativeDemandSchema, TASK_TYPES, TaskType, TeamCapability, teamCapabilitySchema (+2 more)

### Community 126 - "Community 126"
Cohesion: 0.19
Nodes (9): FlowMetricsResult, FlowPeriod, FlowScope, FlowScopeOption, FlowScopeSchema, getFlowMetrics(), ScopeIdSchema, Props (+1 more)

### Community 127 - "Community 127"
Cohesion: 0.16
Nodes (12): updateKeyResult(), formatDate(), InlineEditKRProps, KeyResultSnapshotItem, KeyResultWithProgress, OKRDetailPanelProps, OKRStatus, progressColor() (+4 more)

### Community 128 - "Community 128"
Cohesion: 0.21
Nodes (11): cancelInvitation(), inviteMember(), removeMember(), updateMemberRole(), updateWorkspace(), EditWorkspaceModal(), EditWorkspaceModalProps, Invitation (+3 more)

### Community 129 - "Community 129"
Cohesion: 0.16
Nodes (10): ProgramBoardHeaderActions(), ProgramBoardHeaderActionsProps, CreateFeatureModal(), CreateFeatureModalProps, FeatureTemplate, FIBONACCI, TemplateKey, TEMPLATES (+2 more)

### Community 130 - "Community 130"
Cohesion: 0.15
Nodes (6): buildPairs(), CopilotChat(), CopilotChatProps, MessagePair, IconProps, UserIcon()

### Community 131 - "Community 131"
Cohesion: 0.18
Nodes (11): BurndownPoint, CustomTooltipProps, formatSP(), getInitials(), MemberVelocityStat, MemberVelocityTable(), MemberVelocityTableProps, MetricCardProps (+3 more)

### Community 132 - "Community 132"
Cohesion: 0.22
Nodes (11): activateBpmnDefinition(), WorkflowRow(), WorkflowRowData, WorkflowRowProps, WorkflowTone, WorkflowToggle(), WorkflowToggleProps, getTeamsWithWorkflows() (+3 more)

### Community 133 - "Community 133"
Cohesion: 0.18
Nodes (11): BpmnCursors(), Props, ROLE_COLORS, BpmnWrapper(), BpmnWrapperProps, customTranslateModule(), IssueMap, PT (+3 more)

### Community 134 - "Community 134"
Cohesion: 0.21
Nodes (11): getPIPlanFullDetails(), saveMiroBoardUrl(), MiroBoardPanel(), Props, toEmbedUrl(), ConfidenceVote, metadata, MiroTab() (+3 more)

### Community 135 - "Community 135"
Cohesion: 0.22
Nodes (10): listTagRules(), conditionOperatorLabel(), formatCondition(), TagRuleList(), TagRuleListProps, TagRuleRow(), TONE_STYLE, TagRulesHeaderActions() (+2 more)

### Community 136 - "Community 136"
Cohesion: 0.26
Nodes (8): createDependency(), CreateDependencySchema, getDependencies(), getEpicsWithFeatures(), DependencyWithFeatures, DependenciesPage(), DependencyDashboard, metadata

### Community 137 - "Community 137"
Cohesion: 0.23
Nodes (12): ALLOWED_ROLES_RTE, BOARD_STATUSES, CircularCheckOpts, createDependencyLink(), CreateLinkSchema, detectCircular(), GetBoardSchema, getProgramBoardData() (+4 more)

### Community 138 - "Community 138"
Cohesion: 0.24
Nodes (10): addPrinciple(), removePrinciple(), reorderPrinciples(), upsertLACE(), AddPrincipleInput, AddPrincipleSchema, UpsertLACEInput, UpsertLACESchema (+2 more)

### Community 139 - "Community 139"
Cohesion: 0.22
Nodes (9): completeFlow(), getOrCreateProgress(), saveStep(), FlowType, SaveStepSchema, CompanyWizardClient(), CompanySetupPage(), MigrationWizardClient() (+1 more)

### Community 140 - "Community 140"
Cohesion: 0.19
Nodes (10): assertNotLastAdmin(), BulkInviteResult, BulkInviteRow, RemoveMemberResult, removeMemberSafe(), revokeUserSessions(), SecurityPolicyInput, SecurityPolicySchema (+2 more)

### Community 141 - "Community 141"
Cohesion: 0.19
Nodes (8): NotificationMeta, NotificationsCell(), NotificationsCellProps, PIP_COLORS, relativeTime(), getRiskTagStyle(), RteHome(), RteHomeProps

### Community 142 - "Community 142"
Cohesion: 0.22
Nodes (11): avatarStyleForRole(), MemberTone, ROLE_LABELS, ROLE_TONE, TONE_VARS, toneForRole(), initialsOf(), Invitation (+3 more)

### Community 143 - "Community 143"
Cohesion: 0.20
Nodes (9): generatePIRetroReport(), PIRetroImpediment, PIRetroObjective, PIRetroReport, PIRetroRisk, PIRetroSprint, OBJ_STATUS_COLORS, PIRetroPage() (+1 more)

### Community 144 - "Community 144"
Cohesion: 0.27
Nodes (11): ALLOWED_ROLES_RTE, computeReadiness(), createARTFeature(), CreateARTFeatureSchema, evaluateFeatureReadiness(), EvaluateReadinessSchema, generateArtScopedId(), markFeatureReady() (+3 more)

### Community 145 - "Community 145"
Cohesion: 0.24
Nodes (11): CopilotPanel(), applyChunk(), fetchStream(), FetchStreamOptions, nanoid(), processLines(), readDataStream(), StreamState (+3 more)

### Community 146 - "Community 146"
Cohesion: 0.26
Nodes (9): CosmosPersona, CosmosTopbar(), CosmosTopbarProps, revealVariants, buildBreadcrumb(), CosmosTopbarShell(), CosmosTopbarShellProps, getInitials() (+1 more)

### Community 147 - "Community 147"
Cohesion: 0.20
Nodes (10): CreateStoryModal(), CreateStoryModalProps, FIBONACCI_STORY, MOCK_ASSIGNEES, PRIORITIES, Priority, PRIORITY_MAP, STORY_TEMPLATES (+2 more)

### Community 148 - "Community 148"
Cohesion: 0.18
Nodes (10): containerVariants, FunnelStep, FunnelStepper(), FunnelStepperProps, FunnelStepState, stepVariants, LifecycleSection(), LifecycleSectionProps (+2 more)

### Community 149 - "Community 149"
Cohesion: 0.23
Nodes (7): BpmnValidationError, diffBpmnDefinitions(), DiffChange, extractBpmnGraph(), saveBpmnDefinition(), SaveBpmnParams, Props

### Community 150 - "Community 150"
Cohesion: 0.22
Nodes (7): getPortfolioCFDData(), PortfolioCFDData, PortfolioCFDPoint, PortfolioDistribution, STATUS_LABELS, PortfolioCFDChart(), STATUS_COLORS

### Community 151 - "Community 151"
Cohesion: 0.25
Nodes (7): createOnboardingWorkspace(), slugify(), extractTotpSecret(), OnboardingWizard(), Props, Step, Props

### Community 152 - "Community 152"
Cohesion: 0.25
Nodes (6): ArtHealthRow, PortfolioOverviewData, ArtHealthGrid(), formatBudget(), getHealth(), PortfolioKpiRowProps

### Community 153 - "Community 153"
Cohesion: 0.31
Nodes (8): getSSOConfig(), saveSSOConfig(), SaveSSOConfigSchema, SSOConfigData, metadata, SSOSettingsPage(), Props, SSOConfigForm()

### Community 154 - "Community 154"
Cohesion: 0.24
Nodes (10): AcceptDraftSchema, acceptStoryDrafts(), decomposeFeatureWithAI(), DecomposeSchema, NewStorySchema, SPLIT_STRATEGIES, splitStory(), SplitStorySchema (+2 more)

### Community 155 - "Community 155"
Cohesion: 0.24
Nodes (7): AIAccessStatus, FeatureSuggestion, RebalancingResult, AI_LOADING_MESSAGES, IMPACT_LABELS, Phase, STEPS

### Community 156 - "Community 156"
Cohesion: 0.27
Nodes (10): FIBONACCI, findInvalidFibonacci(), getScoringHistory(), lockJobSizeAction(), LockJobSizeSchema, recomputeNormalized(), SA_LOCK_ROLES, scoreWsjfAction() (+2 more)

### Community 157 - "Community 157"
Cohesion: 0.35
Nodes (6): POST(), GET(), POST(), POST(), POST(), validateCronSecret()

### Community 158 - "Community 158"
Cohesion: 0.18
Nodes (7): BoardCellProps, Feature, FeatureCardProps, PlacedFeature, ProgramBoardEmbeddedProps, STATUS_COLORS, Team

### Community 159 - "Community 159"
Cohesion: 0.25
Nodes (9): CopilotInputArea(), MODE_CHIPS, Props, uploadFileToSession(), uploadIcon(), UploadState, CopilotTipTapEditor(), CopilotTipTapEditorHandle (+1 more)

### Community 160 - "Community 160"
Cohesion: 0.33
Nodes (9): TaskStatus, createTask(), deleteTask(), listTasksByStory(), resolveTaskTeamId(), updateTask(), updateTaskStatus(), CreateTaskSchema (+1 more)

### Community 161 - "Community 161"
Cohesion: 0.31
Nodes (8): BacklogFeatureRow, FeatureBacklogTable(), investTone(), loadPmHomeBodyData(), OkrForTrace, okrProgress(), PmHomeBody(), PmHomeBodyProps

### Community 162 - "Community 162"
Cohesion: 0.29
Nodes (8): Props, Team, TeamCard(), KNOWN_ART_TONE, mockFlowEfficiency(), TeamTone, TONE_CYCLE, toneForArt()

### Community 163 - "Community 163"
Cohesion: 0.27
Nodes (7): getBpmnDefinitionByTeam(), saveBpmnDefinitionLegacy(), BpmnLoader(), BpmnLoaderProps, BpmnWrapperDynamic, BpmnPageProps, BpmnWorkflowPage()

### Community 164 - "Community 164"
Cohesion: 0.36
Nodes (7): ALLOWED_FACILITATOR_ROLES, castAnonymousVote(), CastVoteSchema, OpenNextRoundSchema, openNextVoteRound(), RevealSchema, revealVoteResults()

### Community 165 - "Community 165"
Cohesion: 0.39
Nodes (7): listBillingIntegrations(), getAvailablePeriods(), getPortfolioAllocation(), guardrailStatus(), LeanBudgetPage(), LeanBudgetPageProps, metadata

### Community 166 - "Community 166"
Cohesion: 0.25
Nodes (8): checkImpedimentAging(), checkImpedimentAgingSchema, createImpedimentAnomaly(), escalateImpediment(), escalateImpedimentSchema, resolveImpediment(), resolveImpedimentSchema, Tx

### Community 167 - "Community 167"
Cohesion: 0.31
Nodes (3): AnomalyData, RULE_PROMPTS, RecurrenceKind

### Community 168 - "Community 168"
Cohesion: 0.33
Nodes (6): Err, Ok, SynergyPair, updatePairSynergiesForTask(), canonicalPair(), computeSynergyScore()

### Community 169 - "Community 169"
Cohesion: 0.36
Nodes (8): buildWhere(), countRows(), exportData(), ExportInput, ExportResult, ExportSchema, fetchRows(), toCsvDataUrl()

### Community 170 - "Community 170"
Cohesion: 0.28
Nodes (8): RETRO_TEMPLATES, RetroTemplate, ACTION_STATUS_CONFIG, ActionItem, FLOW_METRIC_OPTIONS, InspectAdaptActionsPanel(), Props, SAFE_COMPETENCY_OPTIONS

### Community 171 - "Community 171"
Cohesion: 0.28
Nodes (6): listStories(), Header(), HeaderProps, SearchPage(), SearchPageProperties, StoryRow

### Community 172 - "Community 172"
Cohesion: 0.39
Nodes (7): checkStoryInvest(), evaluateStoryInvest(), InvestBadge, InvestCriterion, InvestLevel, InvestResult, StoryFields

### Community 173 - "Community 173"
Cohesion: 0.39
Nodes (5): colors, getUsers(), searchUsers(), CollaborationProvider(), PortfolioRoom()

### Community 174 - "Community 174"
Cohesion: 0.25
Nodes (6): AnomalyCard(), AnomalyMeta, Props, SEV_COLOR, Anomaly, Props

### Community 175 - "Community 175"
Cohesion: 0.25
Nodes (7): MeasureGrowHeaderActions(), MeasureGrowHeaderActionsProps, ScopeOption, NewAssessmentModal(), NewAssessmentModalProps, SCOPE_LABELS, ScopeOption

### Community 176 - "Community 176"
Cohesion: 0.25
Nodes (7): Feature, loadColor(), STATUS_COLORS, Team, TeamBreakoutPanel(), TeamBreakoutPanelProps, TeamBreakoutViewProps

### Community 177 - "Community 177"
Cohesion: 0.31
Nodes (7): CATEGORY_ENTITY_TYPE, CATEGORY_LABEL, TeamOption, View, WorkflowActions(), BPMN_TEMPLATES, BpmnTemplate

### Community 178 - "Community 178"
Cohesion: 0.36
Nodes (6): analyzeAllEpics(), AnalyzeAllResult, analyzeInvest(), computeHash(), InvestBreakdownSchema, InvestResult

### Community 179 - "Community 179"
Cohesion: 0.43
Nodes (7): verifyFirefliesSignature(), checkWebhookRateLimit(), enqueueToInngest(), FirefliesPayload, isAlreadyProcessed(), logInvalidSignature(), POST()

### Community 180 - "Community 180"
Cohesion: 0.32
Nodes (6): searchMeetings(), SearchMeetingsSchema, MeetingSearchBar(), MeetingsPage(), metadata, SearchParams

### Community 181 - "Community 181"
Cohesion: 0.32
Nodes (7): createRoamRisk(), CreateRoamRiskSchema, ROAM_STATUSES, RoamStatus, roamTransitionRisk(), TransitionSchema, validateRoamGuard()

### Community 182 - "Community 182"
Cohesion: 0.32
Nodes (6): getMyActiveStories(), MyActiveStory, HomeDashboard(), QUICK_LINKS, STATUS_LABELS, STATUS_TONES

### Community 183 - "Community 183"
Cohesion: 0.29
Nodes (7): PillarNode, PillarsOverview(), PillarsOverviewProps, resolveTone(), TONE_SOFT_VAR, TONE_TEXT_VAR, TONE_VAR

### Community 184 - "Community 184"
Cohesion: 0.29
Nodes (6): evaluateGuard(), GuardContext, GuardFn, GUARDS, TransitionResult, transitionWorkflowState()

### Community 185 - "Community 185"
Cohesion: 0.36
Nodes (7): BodySchema, buildPrompt(), computeContentHash(), INVEST_LIMITS, INVEST_WEIGHTS, parseInvestScores(), POST()

### Community 186 - "Community 186"
Cohesion: 0.39
Nodes (7): ALLOWED_TYPES, GET(), getCachedOrSearch(), parsePrefixFilter(), searchEpics(), searchFeatures(), SearchResult

### Community 187 - "Community 187"
Cohesion: 0.32
Nodes (7): activePresetKey(), DEFAULT_WSJF_WEIGHTS, RebalanceWeightsDialog(), RebalanceWeightsDialogProps, WEIGHT_LABELS, WEIGHT_PRESETS, WSJFWeights

### Community 188 - "Community 188"
Cohesion: 0.29
Nodes (6): Avatar(), initials(), StandupAvatarTone, StandupEntryCard(), StandupEntryCardProps, TONE_STYLE

### Community 189 - "Community 189"
Cohesion: 0.43
Nodes (5): EpicCostResult, getEpicCost(), EpicCostBadge(), formatCompact(), Props

### Community 190 - "Community 190"
Cohesion: 0.33
Nodes (5): ReEvaluateResponse, reEvaluateSnapshot(), MetricComparison, Props, ReEvaluateModal()

### Community 191 - "Community 191"
Cohesion: 0.43
Nodes (6): advanceToNextStep(), bypassApproval(), BypassSchema, DecideSchema, processApprovalDecision(), WorkflowStep

### Community 192 - "Community 192"
Cohesion: 0.38
Nodes (6): DashboardLayout, DashboardTile, getDashboardLayout(), TileSchema, upsertDashboardLayout(), UpsertLayoutSchema

### Community 193 - "Community 193"
Cohesion: 0.38
Nodes (5): SAFE_KNOWLEDGE_PAIRS, SafeKnowledgePair, embedAndUpsertBatch(), KnowledgeChunk, syncSafeFrameworkKnowledge()

### Community 194 - "Community 194"
Cohesion: 0.29
Nodes (4): IconName, KpiCardProps, Tone, TONES

### Community 195 - "Community 195"
Cohesion: 0.33
Nodes (4): Props, CONFIG, FlowStalenessBadge(), Props

### Community 196 - "Community 196"
Cohesion: 0.29
Nodes (5): COMPETENCY_KEYS, Profile, Props, SHORT, SKILL_COLOR

### Community 197 - "Community 197"
Cohesion: 0.43
Nodes (5): KeyboardProvider(), NAV_BINDINGS, NavBinding, useKeyboardNav(), UseKeyboardNavReturn

### Community 198 - "Community 198"
Cohesion: 0.38
Nodes (4): AcceptInviteForm(), getPasswordStrength(), Props, Props

### Community 199 - "Community 199"
Cohesion: 0.40
Nodes (5): PortfolioConfidence, DeliveryConfidenceWidget(), DeliveryConfidenceWidgetProps, fmt(), RISK_DOT

### Community 200 - "Community 200"
Cohesion: 0.53
Nodes (4): checkKRThresholds(), fireThresholdNotification(), crossedThresholds(), KR_THRESHOLDS

### Community 201 - "Community 201"
Cohesion: 0.40
Nodes (3): approveMigrationMapping(), saveMigrationConnection(), SourceSchema

### Community 202 - "Community 202"
Cohesion: 0.53
Nodes (5): COLORS, logCrossTenantAttempt(), POST(), randomColor(), WRITE_ROLES

### Community 203 - "Community 203"
Cohesion: 0.60
Nodes (5): GET(), getDbMetrics(), getFallbackQueueDepth(), getInngestMetrics(), getRedisMetrics()

### Community 204 - "Community 204"
Cohesion: 0.40
Nodes (5): PiRelationChip(), PiRelationChipPlan, Props, STATUS_TONE, statusTone()

### Community 206 - "Community 206"
Cohesion: 0.40
Nodes (5): formatCurrencyShort(), TONE_COLOR, UsageBar(), UsageBarProps, UsageBarTone

### Community 207 - "Community 207"
Cohesion: 0.33
Nodes (3): COLUMNS, KanbanCardItem, SortableCard

### Community 209 - "Community 209"
Cohesion: 0.70
Nodes (4): linearMutation(), pushCosmosLabelToLinear(), pushEpicToLinear(), pushStoryStatusToLinear()

### Community 210 - "Community 210"
Cohesion: 0.50
Nodes (4): ELEVATED_ROLES, KnowledgeSearchOptions, KnowledgeSearchResult, runKnowledgeSearch()

### Community 211 - "Community 211"
Cohesion: 0.60
Nodes (4): FEATURE_SELECT, GET(), getErrorCode(), parsePagination()

### Community 212 - "Community 212"
Cohesion: 0.70
Nodes (4): checkImportRateLimit(), createMigrationEntities(), fetchItems(), POST()

### Community 213 - "Community 213"
Cohesion: 0.60
Nodes (4): checkWebhookRateLimit(), FathomPayload, isAlreadyProcessed(), POST()

### Community 214 - "Community 214"
Cohesion: 0.50
Nodes (4): AssignmentValue, POST(), StorageData, syncAssignments()

### Community 215 - "Community 215"
Cohesion: 0.50
Nodes (3): EpicMetricCards(), EpicMetricCardsProps, WSJF_VALUE_CLASS()

### Community 218 - "Community 218"
Cohesion: 0.83
Nodes (3): forbidden(), GET(), unauthorized()

### Community 220 - "Community 220"
Cohesion: 0.67
Nodes (3): FlowEfficiencyGauge(), getEfficiencyColor(), Props

### Community 221 - "Community 221"
Cohesion: 0.67
Nodes (3): FlowPredictabilityChart(), getPredictabilityColorClass(), Props

## Knowledge Gaps
- **1412 isolated node(s):** `StatusBadgeConfig`, `STATUS_BADGE`, `PAERowProps`, `PAETabsProps`, `metadata` (+1407 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **33 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `safeAction()` connect `Community 0` to `Community 1`, `Community 2`, `Community 3`, `Community 5`, `Community 135`, `Community 137`, `Community 138`, `Community 10`, `Community 9`, `Community 13`, `Community 14`, `Community 12`, `Community 144`, `Community 20`, `Community 21`, `Community 24`, `Community 26`, `Community 154`, `Community 156`, `Community 31`, `Community 160`, `Community 33`, `Community 34`, `Community 35`, `Community 164`, `Community 165`, `Community 166`, `Community 36`, `Community 40`, `Community 169`, `Community 43`, `Community 171`, `Community 172`, `Community 48`, `Community 178`, `Community 181`, `Community 56`, `Community 191`, `Community 192`, `Community 65`, `Community 64`, `Community 72`, `Community 73`, `Community 80`, `Community 81`, `Community 85`, `Community 89`, `Community 90`, `Community 91`, `Community 92`, `Community 93`, `Community 94`, `Community 95`, `Community 97`, `Community 102`, `Community 107`, `Community 123`, `Community 124`, `Community 127`?**
  _High betweenness centrality (0.144) - this node is a cross-community bridge._
- **Why does `PageHeader()` connect `Community 103` to `Community 2`, `Community 3`, `Community 132`, `Community 6`, `Community 135`, `Community 136`, `Community 9`, `Community 8`, `Community 11`, `Community 12`, `Community 13`, `Community 14`, `Community 143`, `Community 15`, `Community 16`, `Community 20`, `Community 21`, `Community 22`, `Community 24`, `Community 153`, `Community 26`, `Community 28`, `Community 29`, `Community 30`, `Community 35`, `Community 36`, `Community 37`, `Community 165`, `Community 44`, `Community 48`, `Community 51`, `Community 180`, `Community 52`, `Community 54`, `Community 68`, `Community 72`, `Community 73`, `Community 74`, `Community 76`, `Community 83`, `Community 84`, `Community 88`, `Community 91`, `Community 93`, `Community 98`, `Community 99`, `Community 106`, `Community 110`, `Community 114`, `Community 118`, `Community 121`?**
  _High betweenness centrality (0.090) - this node is a cross-community bridge._
- **Why does `Result` connect `Community 0` to `Community 1`, `Community 2`, `Community 3`, `Community 5`, `Community 137`, `Community 138`, `Community 10`, `Community 9`, `Community 13`, `Community 14`, `Community 143`, `Community 144`, `Community 12`, `Community 20`, `Community 21`, `Community 150`, `Community 24`, `Community 153`, `Community 26`, `Community 154`, `Community 156`, `Community 29`, `Community 30`, `Community 31`, `Community 160`, `Community 33`, `Community 34`, `Community 35`, `Community 164`, `Community 37`, `Community 166`, `Community 169`, `Community 43`, `Community 172`, `Community 48`, `Community 178`, `Community 51`, `Community 181`, `Community 56`, `Community 191`, `Community 192`, `Community 65`, `Community 64`, `Community 72`, `Community 80`, `Community 81`, `Community 83`, `Community 85`, `Community 89`, `Community 90`, `Community 91`, `Community 92`, `Community 94`, `Community 96`, `Community 97`, `Community 102`, `Community 107`, `Community 123`, `Community 124`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Are the 17 inferred relationships involving `err` (e.g. with `updateEpic()` and `fireThresholdNotification()`) actually correct?**
  _`err` has 17 INFERRED edges - model-reasoned connections that need verification._
- **What connects `StatusBadgeConfig`, `STATUS_BADGE`, `PAERowProps` to the rest of the system?**
  _1415 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.03431708991077557 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05985915492957746 - nodes in this community are weakly interconnected._