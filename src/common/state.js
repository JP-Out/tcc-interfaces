(function attachCommonState(global) {
  const { DEFAULT_PARTICIPANT } = global.SGOAData;

  function createInitialState() {
    return {
      isResearchStarted: false,
      isResearchGateDismissed: false,
      isOnboardingTourOpen: false,
      hasOnboardingTourBeenAcknowledged: false,
      onboardingTourStepIndex: 0,
      introChallenge: null,
      activeView: "home",
      isSidebarCollapsed: true,
      researchTaskId: "",
      objectiveProfileId: "",
      objectiveSets: [],
      currentObjectiveId: "",
      allObjectivesTerminal: false,
      objectiveFeedback: null,
      isObjectiveFailureModalOpen: false,
      objectiveFailureTargetId: "",
      objectiveFailureDependentIds: [],
      objectiveTrackedPinnedWorkshopCode: "",
      objectiveTrackedQuickAccessWorkshopCode: "",
      objectiveRemovedQuickAccessWorkshopCode: "",
      selectedWorkshopSource: "",
      currentParticipantCode: DEFAULT_PARTICIPANT.identifier,
      currentParticipantCourse: DEFAULT_PARTICIPANT.course,
      currentFirstAccessDate: DEFAULT_PARTICIPANT.firstAccessDate,
      currentLastAccessDateTime: DEFAULT_PARTICIPANT.lastAccessDateTime,
      currentSessionId: "",
      lastManageWorkshopAccessTitle: "",
      participantRecords: [],
      participantRecordCounter: 0,
      linkedWorkshopCodes: [],
      completedWorkshopCodes: [],
      pinnedWorkshopCodes: [],
      hasWorkshopSearch: false,
      workshopSearchQuery: "",
      workshopSearchMode: "",
      workshopSearchFilters: [],
      workshopSearchHistory: [],
      workshopSearchMatchedTerms: [],
      workshopSearchResults: [],
      workshopSearchNavigationCodes: [],
      workshopSearchDetailIndex: -1,
      hasConsumedWorkshopSearch: false,
      selectedWorkshopCode: "",
      isOfficeModalOpen: false,
      isConfirmModalOpen: false,
    };
  }

  global.SGOAState = {
    createInitialState,
  };
}(window));
