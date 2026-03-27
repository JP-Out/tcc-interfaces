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
      currentFirstAccessDate: DEFAULT_PARTICIPANT.firstAccessDate,
      currentLastAccessDateTime: DEFAULT_PARTICIPANT.lastAccessDateTime,
      participantRecords: [],
      participantRecordCounter: 0,
      linkedWorkshopCodes: [],
      pinnedWorkshopCodes: [],
      hasWorkshopSearch: false,
      workshopSearchQuery: "",
      workshopSearchMode: "code",
      workshopSearchFilter: "open",
      workshopSearchMatchedTerms: [],
      workshopSearchResults: [],
      selectedWorkshopCode: "",
      isOfficeModalOpen: false,
      isConfirmModalOpen: false,
    };
  }

  global.SGOAState = {
    createInitialState,
  };
}(window));
