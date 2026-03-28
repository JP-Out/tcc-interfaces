(function attachCommonState(global) {
  const { DEFAULT_PARTICIPANT } = global.SGOAData;

  function createInitialState() {
    return {
      isResearchStarted: false,
      activeView: "home",
      isSidebarCollapsed: true,
      isLoggedIn: false,
      currentUserIdentifier: "",
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
