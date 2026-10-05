import { beforeEach, describe, expect, it } from 'vitest';
import { useSettings } from '../src/store/settings';

describe('settings store - saved locations and view mode', () => {
  beforeEach(() => {
    useSettings.setState({
      location: null,
      savedLocations: [],
      viewMode: 'grid',
    });
  });

  it('defaults view mode to grid and changes view mode', () => {
    expect(useSettings.getState().viewMode).toBe('grid');
    useSettings.getState().setViewMode('compact');
    expect(useSettings.getState().viewMode).toBe('compact');
  });

  it('adds and selects saved locations', () => {
    const loc1 = useSettings.getState().addSavedLocation({
      lat: 35.7001,
      lng: 51.4001,
      label: 'خانه',
    });

    expect(loc1.id).toBeDefined();
    expect(useSettings.getState().savedLocations).toHaveLength(1);
    expect(useSettings.getState().location).toEqual(loc1);

    const loc2 = useSettings.getState().addSavedLocation({
      lat: 35.8002,
      lng: 51.5002,
      label: 'محل کار',
    });

    expect(useSettings.getState().savedLocations).toHaveLength(2);
    expect(useSettings.getState().location).toEqual(loc2);
  });

  it('selects an existing saved location', () => {
    const loc1 = useSettings.getState().addSavedLocation({
      lat: 35.7001,
      lng: 51.4001,
      label: 'خانه',
    });

    useSettings.getState().selectLocation(loc1);
    expect(useSettings.getState().location).toEqual(loc1);
  });

  it('updates label of a saved location', () => {
    const loc = useSettings.getState().addSavedLocation({
      lat: 35.7001,
      lng: 51.4001,
      label: 'خانه قدیم',
    });

    useSettings.getState().updateSavedLocationLabel(loc.id!, 'خانه جدید');
    expect(useSettings.getState().savedLocations[0].label).toBe('خانه جدید');
    expect(useSettings.getState().location?.label).toBe('خانه جدید');
  });

  it('removes a saved location and updates current location if needed', () => {
    const loc1 = useSettings.getState().addSavedLocation({
      lat: 35.7001,
      lng: 51.4001,
      label: 'خانه',
    });
    const loc2 = useSettings.getState().addSavedLocation({
      lat: 35.8002,
      lng: 51.5002,
      label: 'محل کار',
    });

    // Currently loc2 is active
    useSettings.getState().removeSavedLocation(loc2.id!);
    expect(useSettings.getState().savedLocations).toHaveLength(1);
    expect(useSettings.getState().location).toEqual(loc1);
  });
});
