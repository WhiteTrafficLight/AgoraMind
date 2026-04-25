import { useState, useEffect, useCallback } from 'react';
import { DebateStage, DebateState, TurnInfo } from '@/types/debate';

export function useDebateState() {
  const [debateState, setDebateState] = useState<DebateState>({
    currentStage: DebateStage.OPENING,
    isUserTurn: false,
    turnIndicatorVisible: false,
    selectedNpcId: null,
    isGeneratingResponse: false,
    isGeneratingNext: false,
    inputDisabled: true,
  });

  const setUserTurn = useCallback((isUserTurn: boolean, showIndicator = true) => {
    setDebateState(prev => ({
      ...prev,
      isUserTurn,
      turnIndicatorVisible: isUserTurn && showIndicator,
      inputDisabled: !isUserTurn,
    }));
  }, []);

  const setSelectedNpc = useCallback((npcId: string | null, autoHideDelay = 3000) => {
    setDebateState(prev => ({
      ...prev,
      selectedNpcId: npcId,
    }));

    if (npcId && autoHideDelay > 0) {
      setTimeout(() => {
        setDebateState(prev => ({
          ...prev,
          selectedNpcId: null,
        }));
      }, autoHideDelay);
    }
  }, []);

  const setGeneratingResponse = useCallback((isGenerating: boolean) => {
    setDebateState(prev => ({
      ...prev,
      isGeneratingResponse: isGenerating,
    }));
  }, []);

  // Next
  const setGeneratingNext = useCallback((isGenerating: boolean) => {
    setDebateState(prev => ({
      ...prev,
      isGeneratingNext: isGenerating,
    }));
  }, []);

  const setCurrentStage = useCallback((stage: DebateStage) => {
    setDebateState(prev => ({
      ...prev,
      currentStage: stage,
    }));
  }, []);

  const isInputDisabled = useCallback((): boolean => {
    return !debateState.isUserTurn || debateState.isGeneratingResponse;
  }, [debateState.isUserTurn, debateState.isGeneratingResponse]);

  const shouldShowNextMessageButton = useCallback((
    isDebateRoom: boolean,
    onRequestNextMessage?: () => void,
    messagesLength = 0
  ): boolean => {
    if (!isDebateRoom || !onRequestNextMessage || debateState.isGeneratingResponse) {
      return false;
    }
    // Next ( )
    return true;
  }, [debateState.isGeneratingResponse]);

  const updateTurnInfo = useCallback((turnInfo: TurnInfo) => {
    setUserTurn(turnInfo.isUserTurn, true);
  }, [setUserTurn]);

  const resetDebateState = useCallback(() => {
    setDebateState({
      currentStage: DebateStage.OPENING,
      isUserTurn: false,
      turnIndicatorVisible: false,
      selectedNpcId: null,
      isGeneratingResponse: false,
      isGeneratingNext: false,
      inputDisabled: true,
    });
  }, []);

  return {
    debateState,
    isInputDisabled: isInputDisabled(),
    
    setUserTurn,
    setSelectedNpc,
    setGeneratingResponse,
    setGeneratingNext,
    setCurrentStage,
    updateTurnInfo,
    resetDebateState,
    
    shouldShowNextMessageButton,
    
    currentStage: debateState.currentStage,
    isUserTurn: debateState.isUserTurn,
    turnIndicatorVisible: debateState.turnIndicatorVisible,
    selectedNpcId: debateState.selectedNpcId,
    isGeneratingResponse: debateState.isGeneratingResponse,
    isGeneratingNext: debateState.isGeneratingNext,
  };
} 